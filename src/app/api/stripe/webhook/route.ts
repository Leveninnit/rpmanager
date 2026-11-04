import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && plan) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const subAny = subscription as unknown as Record<string, any>;
          const periodEnd = subAny.current_period_end
            ? new Date(subAny.current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await prisma.user.update({
            where: { id: userId },
            data: {
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: session.customer as string,
              stripePriceId: subscription.items.data[0]?.price.id,
              stripeCurrentPeriodEnd: periodEnd,
              subscriptionTier: plan,
            },
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceAny = invoice as unknown as Record<string, any>;
        const subscriptionId =
          (invoiceAny.subscription as string) ||
          (invoiceAny.parent?.subscription_details?.subscription as string);

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const subAny = subscription as unknown as Record<string, any>;
          const periodEnd = subAny.current_period_end
            ? new Date(subAny.current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await prisma.user.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: {
              stripePriceId: subscription.items.data[0]?.price.id,
              stripeCurrentPeriodEnd: periodEnd,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
            subscriptionTier: "free",
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subAny = subscription as unknown as Record<string, any>;
        const priceId = subscription.items.data[0]?.price.id;
        const periodEnd = subAny.current_period_end
          ? new Date(subAny.current_period_end * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Determine plan from price ID
        let plan = "free";
        if (priceId === process.env.STRIPE_STARTER_PRICE_ID) plan = "starter";
        else if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "pro";
        else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID)
          plan = "enterprise";

        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: periodEnd,
            subscriptionTier:
              subscription.status === "active" ? plan : "free",
          },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
