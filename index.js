const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

/* ===================== الإعدادات ===================== */
const TOKEN = process.env.TOKEN;
const CONFIG = {
  activationChannel: "1462897483763159264",
  staffChannel: "1462897483763159264",
  acceptRole: "1373057220736061500",

  activatedRole: "1349592707462467706",
  adminRole: "1465682367598559496",
  modRole: "1465682367598559496",
  devRole: "1465682367598559496",
};

/* ===================== نظام دوام العساكر ===================== */
const dutyUsers = new Set();
let dutyMessage = null;

/* ===================== تشغيل البوت ===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);
});

/* ===================== الأوامر ===================== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  /* ===== تفعيل ===== */
  if (message.content === "تفعيل") {
    const embed = new EmbedBuilder()
      .setTitle("📋 نظام التفعيل")
      .setDescription("اختر تقديم تفعيل")
      .setColor("Green");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("activation_menu")
      .addOptions([{ label: "تقديم تفعيل", value: "apply" }]);

    return message.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  /* ===== مينو ===== */
  if (message.content === "مينو") {
    const embed = new EmbedBuilder()
      .setTitle("📋 التقديم على الطاقم")
      .setDescription("اختر القسم")
      .setColor("Blue");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("staff_menu")
      .addOptions([
        { label: "إدارة", value: "admin" },
        { label: "رقابة", value: "mod" },
        { label: "مطور", value: "dev" }
      ]);

    return message.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  /* ===== تسجيل دخول ===== */
  if (message.content === "تسجيل دخول عساكر") {
    const embed = new EmbedBuilder()
      .setTitle("🪖 نظام دوام العساكر")
      .setDescription("**المداومين الآن:**\nما فيه مداومين")
      .setColor("DarkGreen");

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("duty_in").setLabel("تسجيل دخول").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("duty_out").setLabel("تسجيل خروج").setStyle(ButtonStyle.Danger)
    );

    dutyMessage = await message.channel.send({ embeds: [embed], components: [buttons] });
  }
});

/* ===================== التفاعلات ===================== */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== تفعيل ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "activation_menu") {
    if (interaction.values[0] !== "apply") return;

    const modal = new ModalBuilder()
      .setCustomId("activation_modal")
      .setTitle("📋 تقديم تفعيل");

    modal.addComponents(
      inputRow("name", "اسمك"),
      inputRow("age", "عمرك"),
      inputRow("from", "من وين شرفتنا"),
      inputRow("reason", "سبب دخولك للسيرفر"),
      inputRow("rules", "هل تتعهد بقراءة القوانين و عدم تخريب اي ام لا؟", TextInputStyle.Paragraph)
    );

    return interaction.showModal(modal);
  }

  /* ===== الطاقم ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "staff_menu") {
    const type = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`staff_${type}`)
      .setTitle("📋 تقديم طاقم");

    modal.addComponents(
      inputRow("اسمك", "اسمك"),
      inputRow("عمرك", "عمرك"),
      inputRow("خبراتك", "خبراتك"),
      inputRow("مستعد تحلف صوتي", "مستعد للحلف الصوتي؟")
    );

    return interaction.showModal(modal);
  }

  /* ===== إرسال التقديم ===== */
  if (interaction.isModalSubmit()) {
    let roleToGive = null;
    let channelId = CONFIG.staffChannel;

    if (interaction.customId === "activation_modal") {
      roleToGive = CONFIG.activatedRole;
      channelId = CONFIG.activationChannel;
    }
    if (interaction.customId === "staff_admin") roleToGive = CONFIG.adminRole;
    if (interaction.customId === "staff_mod") roleToGive = CONFIG.modRole;
    if (interaction.customId === "staff_dev") roleToGive = CONFIG.devRole;

    const embed = new EmbedBuilder()
      .setTitle("📥 تقديم جديد")
      .setDescription(
        interaction.fields.fields.map(f => `**${f.customId}**: ${f.value}`).join("\n")
      )
      .setColor("Orange");

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_${interaction.user.id}_${roleToGive}`)
        .setLabel("قبول")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${interaction.user.id}`)
        .setLabel("رفض")
        .setStyle(ButtonStyle.Danger)
    );

    const channel = interaction.guild.channels.cache.get(channelId);
    await channel.send({ embeds: [embed], components: [buttons] });

    return interaction.reply({ content: "✅ تم إرسال تقديمك", flags: 64 });
  }

  /* ===== قبول / رفض ===== */
  if (
    interaction.isButton() &&
    (interaction.customId.startsWith("accept_") ||
     interaction.customId.startsWith("reject_"))
  ) {
    if (!interaction.member.roles.cache.has(CONFIG.acceptRole))
      return interaction.reply({ content: "❌ لا تملك صلاحية", flags: 64 });

    const [action, userId, roleId] = interaction.customId.split("_");
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return interaction.reply({ content: "❌ العضو غير موجود", flags: 64 });

    if (action === "accept") {
      if (roleId) await member.roles.add(roleId);
      return interaction.update({ content: "✅ تم القبول", components: [] });
    }

    if (action === "reject") {
      return interaction.update({ content: "❌ تم الرفض", components: [] });
    }
  }

  /* ===== تسجيل دخول ===== */
  if (interaction.isButton() && interaction.customId === "duty_in") {
    if (dutyUsers.has(interaction.user.id))
      return interaction.reply({ content: "❌ أنت مسجل دخول", flags: 64 });

    dutyUsers.add(interaction.user.id);
    await updateDutyEmbed();
    return interaction.reply({ content: "🟢 تم تسجيل دخولك", flags: 64 });
  }

  /* ===== تسجيل خروج ===== */
  if (interaction.isButton() && interaction.customId === "duty_out") {
    if (!dutyUsers.has(interaction.user.id))
      return interaction.reply({ content: "❌ أنت غير مسجل دخول", flags: 64 });

    dutyUsers.delete(interaction.user.id);
    await updateDutyEmbed();
    return interaction.reply({ content: "🔴 تم تسجيل خروجك", flags: 64 });
  }
});

/* ===================== تحديث الإيمبيد ===================== */
async function updateDutyEmbed() {
  if (!dutyMessage) return;

  const list = dutyUsers.size
    ? [...dutyUsers].map(id => `• <@${id}>`).join("\n")
    : "ما فيه مداومين";

  const embed = EmbedBuilder.from(dutyMessage.embeds[0])
    .setDescription(`**المداومين الآن:**\n${list}`);

  await dutyMessage.edit({ embeds: [embed] });
}

/* ===================== مساعد ===================== */
function inputRow(id, label, style = TextInputStyle.Short) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(true)
  );
}

client.login(TOKEN);
