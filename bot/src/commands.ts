import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { RPManagerApi } from "./api";

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to your RPManager account"),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check your linked RPManager membership status"),
  new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Privately view your configured department roster")
    .addIntegerOption((option) =>
      option.setName("page").setDescription("Roster page").setMinValue(1).setMaxValue(50)
    ),
  new SlashCommandBuilder()
    .setName("duty")
    .setDescription("Use the RPManager duty clock")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("clock-in")
        .setDescription("Start a website duty shift")
        .addStringOption((option) =>
          option
            .setName("callsign")
            .setDescription("Your callsign for this shift")
            .setMaxLength(32)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("clock-out").setDescription("End your active duty shift")
    ),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Submit or review a leave request")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("pending")
        .setDescription("Privately list leave requests awaiting review")
        .addIntegerOption((option) =>
          option.setName("page").setDescription("Request page").setMinValue(1).setMaxValue(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("request")
        .setDescription("Privately submit a leave request")
        .addStringOption((option) =>
          option.setName("start_date").setDescription("Start date (YYYY-MM-DD)").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("end_date").setDescription("End date (YYYY-MM-DD)").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Private reason visible only in RPManager")
            .setRequired(true)
            .setMaxLength(2000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("review")
        .setDescription("Approve or deny a pending leave request")
        .addStringOption((option) =>
          option.setName("request_id").setDescription("RPManager leave request ID").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("decision")
            .setDescription("Review outcome")
            .setRequired(true)
            .addChoices(
              { name: "Approve", value: "APPROVED" },
              { name: "Deny", value: "DENIED" }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName("sop")
    .setDescription("Find, read, and acknowledge department SOPs")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List department SOPs")
        .addIntegerOption((option) =>
          option.setName("page").setDescription("SOP page").setMinValue(1).setMaxValue(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("read")
        .setDescription("Read one SOP privately")
        .addStringOption((option) =>
          option.setName("sop_id").setDescription("SOP ID from /sop list").setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName("page").setDescription("Content page").setMinValue(1).setMaxValue(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("acknowledge")
        .setDescription("Acknowledge the current SOP version")
        .addStringOption((option) =>
          option.setName("sop_id").setDescription("SOP ID from /sop list").setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName("application")
    .setDescription("Check your RPManager application status")
    .addSubcommand((subcommand) =>
      subcommand.setName("status").setDescription("Privately check your applications")
    ),
].map((command) => command.toJSON());

type JsonRecord = Record<string, unknown>;

function getRoleIds(interaction: ChatInputCommandInteraction) {
  const member = interaction.member;
  if (!member) return [];
  return Array.isArray(member.roles)
    ? [...member.roles]
    : [...member.roles.cache.keys()];
}

async function callApi<T>(
  interaction: ChatInputCommandInteraction,
  api: RPManagerApi,
  action: string,
  input: JsonRecord = {}
) {
  if (!interaction.guildId) {
    throw new Error("Use RPManager commands in a configured Discord server.");
  }
  const response = await api.command<T>({
    interactionId: interaction.id,
    guildId: interaction.guildId,
    discordId: interaction.user.id,
    roleIds: getRoleIds(interaction),
    action,
    input,
  });
  return response.data;
}

function fitReply(value: string) {
  return value.length > 1900 ? `${value.slice(0, 1890)}\n…` : value;
}

function formatStatus(value: JsonRecord) {
  return [
    `Workspace: ${value.community}`,
    `Workspace role: ${value.communityRole}`,
    value.department ? `Department: ${value.department}` : "",
    value.rank ? `Rank: ${value.rank}` : "",
    value.callsign ? `Callsign: ${value.callsign}` : "",
    value.status ? `Department status: ${value.status}` : "",
    "Account link verified.",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatRoster(value: JsonRecord) {
  const members = Array.isArray(value.members) ? value.members : [];
  const header = [
    `**${value.department}${value.subdivision ? ` · ${value.subdivision}` : ""} roster**`,
    `Page ${value.page}`,
  ];
  const lines = members.map((member) => {
    const row = member as JsonRecord;
    const callsign = String(row.callsign || "No callsign").slice(0, 32);
    const name = String(row.name || "Unnamed member").slice(0, 40);
    const rank = String(row.rank || "Member").slice(0, 32);
    const status = String(row.status || "UNKNOWN").slice(0, 16);
    return `• ${callsign} — ${name} · ${rank} · ${status}`;
  });
  if (value.hasMore) lines.push("More members are available on the next page.");
  return [...header, ...lines].join("\n");
}

function formatApplications(value: JsonRecord) {
  const applications = Array.isArray(value.applications) ? value.applications : [];
  if (applications.length === 0) return "No applications are linked to your RPManager account.";
  return applications
    .map((application) => {
      const row = application as JsonRecord;
      return `• ${String(row.department).slice(0, 40)}: ${String(row.status).slice(0, 24)} (${String(row.stage).slice(0, 24)}) · ${String(row.id).slice(0, 30)}`;
    })
    .join("\n");
}

function formatPendingLeave(value: JsonRecord) {
  const requests = Array.isArray(value.requests) ? value.requests : [];
  if (requests.length === 0) return "There are no pending leave requests in this scope.";
  return [
    `**Pending leave requests · page ${value.page}**`,
    ...requests.map((entry) => {
      const request = entry as JsonRecord;
      return `• ${String(request.member).slice(0, 40)} · ${String(request.department).slice(0, 30)} · ${String(request.startDate).slice(0, 10)} to ${String(request.endDate).slice(0, 10)} · ID \`${String(request.id).slice(0, 30)}\``;
    }),
    value.hasMore ? "Use the next page number for more." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function executeSlashCommand(
  interaction: ChatInputCommandInteraction,
  api: RPManagerApi
) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const name = interaction.commandName;
    let response: string;
    if (name === "link") {
      const data = await callApi<JsonRecord>(interaction, api, "link.request");
      response = data.linked
        ? "Your Discord account is already linked to RPManager."
        : `Your one-time link code is **${data.code}**. Sign in to RPManager, open the dashboard's Account section, and enter this code within 10 minutes.`;
    } else if (name === "status") {
      response = formatStatus(
        await callApi<JsonRecord>(interaction, api, "member.status")
      );
    } else if (name === "roster") {
      response = formatRoster(
        await callApi<JsonRecord>(interaction, api, "roster.list", {
          page: interaction.options.getInteger("page") ?? 1,
        })
      );
    } else if (name === "duty") {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "clock-in") {
        const shift = await callApi<JsonRecord>(interaction, api, "duty.clockIn", {
          callsign: interaction.options.getString("callsign") ?? "",
        });
        response = `Clocked in as ${shift.callsign}. Start time: ${new Date(String(shift.startTime)).toLocaleString()}.`;
      } else {
        const shift = await callApi<JsonRecord>(interaction, api, "duty.clockOut");
        response = `Clocked out as ${shift.callsign}. Recorded ${shift.durationMinutes} minute(s).`;
      }
    } else if (name === "leave") {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "request") {
        const leave = await callApi<JsonRecord>(interaction, api, "leave.submit", {
          startDate: interaction.options.getString("start_date", true),
          endDate: interaction.options.getString("end_date", true),
          reason: interaction.options.getString("reason", true),
        });
        response = `Your leave request (${leave.id}) was submitted privately to RPManager. Its reason is not posted to Discord.`;
      } else if (subcommand === "pending") {
        response = formatPendingLeave(
          await callApi<JsonRecord>(interaction, api, "leave.pending", {
            page: interaction.options.getInteger("page") ?? 1,
          })
        );
      } else {
        const leave = await callApi<JsonRecord>(interaction, api, "leave.review", {
          leaveId: interaction.options.getString("request_id", true),
          decision: interaction.options.getString("decision", true),
        });
        response = `Leave request ${leave.id} was ${String(leave.status).toLowerCase()}.`;
      }
    } else if (name === "sop") {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "list") {
        const data = await callApi<JsonRecord>(interaction, api, "sop.list", {
          page: interaction.options.getInteger("page") ?? 1,
        });
        const sops = Array.isArray(data.sops) ? data.sops : [];
        response =
          sops.length === 0
            ? "No SOPs are available in this department."
            : [
                `**SOP library · page ${data.page}**`,
                ...sops.map((entry) => {
                  const sop = entry as JsonRecord;
                  return `• ${String(sop.title).slice(0, 70)} · v${sop.version} · ID \`${sop.id}\``;
                }),
                data.hasMore ? "Use the next page number for more." : "",
              ]
                .filter(Boolean)
                .join("\n");
      } else if (subcommand === "read") {
        const sop = await callApi<JsonRecord>(interaction, api, "sop.read", {
          sopId: interaction.options.getString("sop_id", true),
          page: interaction.options.getInteger("page") ?? 1,
        });
        response = `**${sop.title} · v${sop.version} · page ${sop.page}/${sop.pageCount}**\n${sop.content}`;
      } else {
        const acknowledgement = await callApi<JsonRecord>(
          interaction,
          api,
          "sop.acknowledge",
          { sopId: interaction.options.getString("sop_id", true) }
        );
        response = `Acknowledged **${acknowledgement.title}**, version ${acknowledgement.version}.`;
      }
    } else if (name === "application") {
      const data = await callApi<JsonRecord>(
        interaction,
        api,
        "application.status"
      );
      response = formatApplications(data);
    } else {
      response = "This command is not available.";
    }
    await interaction.editReply({ content: fitReply(response) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The request could not be completed.";
    await interaction.editReply({ content: fitReply(message) });
    if (!(error instanceof Error && error.name === "RPManagerApiError")) {
      console.error("Discord command handler failed", {
        command: interaction.commandName,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
