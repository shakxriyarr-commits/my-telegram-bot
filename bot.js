const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ============================================================
//  SOZLAMALAR
// ============================================================
const BOT_TOKEN     = process.env.BOT_TOKEN;
const ADMIN_ID      = 8030496668;
const ADMIN_USERNAME = '@shaxriiyar';
const KARTA_RAQAM   = '8600 0000 0000 0000';
const KARTA_EGASI   = 'Falonchi Pistonchiyev';
const PORT          = process.env.PORT || 3000;

const COURIERS = [
  { id: 7312694067, name: 'Shahriyor' },
  { id: 222222222,  name: 'Ali'       },
];

// ============================================================
//  BOT VA SERVER
// ============================================================
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.get('/', (_req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// ============================================================
//  MA'LUMOTLAR (xotirada saqlanadi)
// ============================================================
let orderCounter = 1;
let menu = [
  { id: 'b1', name: '🍔 Burger',         price: 30000 },
  { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
  { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
  { id: 'l1', name: '🌯 Lavash',          price: 32000 },
];

const carts       = {};   // { userId: [{id, name, price}] }
const orders      = {};   // { orderId: {...} }
const users       = {};   // { userId: {phone, latitude, longitude} }
const adminState  = {};   // { userId: {step, ...} }
const stats       = { totalSum: 0, items: {} };
const courierStats = {};  // { courierId: count }

// ============================================================
//  KLAVIATURALAR
// ============================================================
const mainKeyboard = Markup.keyboard([
  ['🍴 Menyu',          '🛒 Savatcha'],
  ['🗂 Buyurtmalarim',  '📞 Aloqa'   ],
]).resize();

const adminKeyboard = Markup.keyboard([
  ["➕ Taom qo'shish",     "✏️ Narxni o'zgartirish"],
  ['📊 Kunlik hisobot',    '📦 Faol buyurtmalar'   ],
  ["🗑 Taomni o'chirish",  "🏠 Mijoz menyusiga o'tish"],
]).resize();

const courierKeyboard = Markup.keyboard([
  ['🏁 Topshirilgan buyurtmalarim'],
  ["🏠 Mijoz menyusiga o'tish"],
]).resize();

// ============================================================
//  YORDAMCHI FUNKSIYALAR
// ============================================================
const isCourier = (id) => COURIERS.some((c) => c.id === id);

function getCart(userId) {
  if (!carts[userId]) carts[userId] = [];
  return carts[userId];
}

function cartTotal(cart) {
  return cart.reduce((sum, i) => sum + i.price, 0);
}

async function sendOrderToAdmin(orderId) {
  const o = orders[orderId];
  if (!o) return;

  const itemsText  = o.items.map((i, n) => `${n + 1}. ${i.name}`).join('\n');
  const payText    = o.payType === 'karta'
    ? "💳 Karta (To'lov ma'lumotlari berildi)"
    : "💵 Naqd pul";

  const courierBtns = COURIERS.map((c) =>
    Markup.button.callback(`🚚 ${c.name}`, `ch_${orderId}_${c.id}`)
  );

  await bot.telegram.sendMessage(
    ADMIN_ID,
    `🆕 *BUYURTMA #${orderId}*\n\n` +
    `💰 To'lov: ${payText}\n` +
    `📋 *Tarkibi:*\n${itemsText}\n\n` +
    `📞 Tel: +${o.phone}\n` +
    `💰 Jami: ${o.total.toLocaleString()} so'm`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        courierBtns,
        [Markup.button.callback("👨‍🍳 Tayyorlash",              `lock_${orderId}`)],
        [Markup.button.callback("❌ Rad etish",                  `rej_${orderId}`)],
        [Markup.button.callback("⚠️ Mahsulot tugagan",           `out_list_${orderId}`)],
        [Markup.button.callback("⏳ Buyurtma ko'p (Ogohlantirish)", `busy_${orderId}`)],
      ]),
    }
  );
  await bot.telegram.sendLocation(ADMIN_ID, o.latitude, o.longitude);
}

// ============================================================
//  /start
// ============================================================
bot.start((ctx) => {
  const id = ctx.from.id;
  if (id === ADMIN_ID) {
    return ctx.reply('Admin panel! 🛠', adminKeyboard);
  }
  if (isCourier(id)) {
    return ctx.reply('Kuryer paneli! 🚗', courierKeyboard);
  }
  ctx.reply(
    "Assalomu alaykum! Qopoq Somsa botiga xush kelibsiz! 🥟\n\n" +
    "Urganch tumanida 7 yildan buyon o'zining betakror ta'mi bilan tanilgan " +
    "markazimiz endi Telegram'da ham xizmatingizda! Bizda har doim issiq va " +
    "sarxil somsalarni topasiz.\n\n" +
    "🍴 Bizning menyu:\n" +
    "🥟 Qopoq somsa\n" +
    "💧 Tomchi somsa\n" +
    "🥬 Avashnoy somsa\n\n" +
    "📍 Manzil: Urganch tumani, Raysentr, Buyuk Turon ko'chasi, 1-uy.\n" +
    "📞 Aloqa: +998 (77) 777-77-77\n\n" +
    "Pastdagi tugmalardan birini tanlang va buyurtma berishni boshlang: 👇",
    mainKeyboard
  );
});

// ============================================================
//  ADMIN — menyu boshqaruvi
// ============================================================
bot.hears("➕ Taom qo'shish", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  adminState[ctx.from.id] = { step: 'add_name' };
  ctx.reply('Yangi taom nomini yozing:');
});

bot.hears("✏️ Narxni o'zgartirish", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const btns = menu.map((i) => [Markup.button.callback(i.name, `edit_p_${i.id}`)]);
  ctx.reply('Tahrirlash uchun taomni tanlang:', Markup.inlineKeyboard(btns));
});

bot.hears("🗑 Taomni o'chirish", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const btns = menu.map((i) => [Markup.button.callback(`🗑 ${i.name}`, `del_i_${i.id}`)]);
  ctx.reply("O'chirish uchun taomni tanlang:", Markup.inlineKeyboard(btns));
});

bot.hears('📊 Kunlik hisobot', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  let text = `📊 *Hisobot:*\n💰 Jami: ${stats.totalSum.toLocaleString()} so'm\n\n`;
  for (const [name, count] of Object.entries(stats.items)) {
    text += `🔹 ${name}: ${count} ta\n`;
  }
  ctx.replyWithMarkdown(text || 'Hali buyurtma yo\'q.');
});

bot.hears('📦 Faol buyurtmalar', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const ids = Object.keys(orders);
  if (!ids.length) return ctx.reply("Hozir faol buyurtma yo'q.");
  ids.forEach((id) => {
    const o = orders[id];
    ctx.replyWithMarkdown(
      `📦 *#${id}* — ${o.status}\n` +
      `📋 ${o.items.map((i) => i.name).join(', ')}\n` +
      `💰 ${o.total.toLocaleString()} so'm\n📞 +${o.phone}`
    );
  });
});

bot.action(/edit_p_(.+)/, (ctx) => {
  const id = ctx.match[1];
  const item = menu.find((i) => i.id === id);
  if (!item) return ctx.answerCbQuery("Topilmadi.");
  adminState[ctx.from.id] = { step: 'new_price', itemId: id };
  ctx.reply(`"${item.name}" uchun yangi narxni yozing:`);
  ctx.answerCbQuery();
});

bot.action(/del_i_(.+)/, (ctx) => {
  const id  = ctx.match[1];
  const idx = menu.findIndex((i) => i.id === id);
  if (idx !== -1) {
    const removed = menu.splice(idx, 1)[0];
    ctx.editMessageText(`✅ "${removed.name}" o'chirildi.`);
  }
  ctx.answerCbQuery();
});

// ============================================================
//  MATN HANDLER (admin holatlari + umumiy)
// ============================================================
bot.on('text', (ctx, next) => {
  const userId = ctx.from.id;
  const state  = adminState[userId];
  if (!state || userId !== ADMIN_ID) return next();

  const text = ctx.message.text.trim();

  if (state.step === 'add_name') {
    adminState[userId] = { step: 'add_price', name: text };
    return ctx.reply(`"${text}" narxini yozing (so'mda):`);
  }

  if (state.step === 'add_price') {
    const price = parseInt(text, 10);
    if (isNaN(price) || price <= 0) return ctx.reply('Iltimos, to\'g\'ri son kiriting:');
    menu.push({ id: 'm' + Date.now(), name: state.name, price });
    delete adminState[userId];
    return ctx.reply(`✅ "${state.name}" menyuga qo'shildi!`, adminKeyboard);
  }

  if (state.step === 'new_price') {
    const price = parseInt(text, 10);
    if (isNaN(price) || price <= 0) return ctx.reply('Iltimos, to\'g\'ri son kiriting:');
    const item = menu.find((i) => i.id === state.itemId);
    if (item) {
      item.price = price;
      delete adminState[userId];
      return ctx.reply(`✅ "${item.name}" narxi yangilandi: ${price.toLocaleString()} so'm`, adminKeyboard);
    }
  }
});

// ============================================================
//  ALOQA
// ============================================================
bot.hears('📞 Aloqa', (ctx) => {
  ctx.reply(
    '📞 Biz bilan bog\'lanish:\n\n' +
    `👤 Admin: ${ADMIN_USERNAME}\n` +
    '📞 Tel: +998 (77) 777-77-77\n' +
    '📍 Urganch tumani, Raysentr, Buyuk Turon ko\'chasi, 1-uy.'
  );
});

// ============================================================
//  MIJOZ — MENYU VA SAVATCHA
// ============================================================
bot.hears('🍴 Menyu', (ctx) => {
  if (!menu.length) return ctx.reply("Menyu hozirda bo'sh.");
  const btns = menu.map((i) =>
    Markup.button.callback(`${i.name} — ${i.price.toLocaleString()} so'm`, `add_${i.id}`)
  );
  ctx.reply('🍴 Taom tanlang:', Markup.inlineKeyboard(btns, { columns: 2 }));
});

bot.action(/add_(.+)/, async (ctx) => {
  const id   = ctx.match[1];
  const item = menu.find((i) => i.id === id);
  if (!item) return ctx.answerCbQuery("Bu taom mavjud emas.");
  getCart(ctx.from.id).push({ ...item });
  await ctx.answerCbQuery(`${item.name} savatchangizga qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
  const cart = getCart(ctx.from.id);
  if (!cart.length) return ctx.reply("Savatcha bo'sh 🛒\nMenyudan taom tanlang.");

  let text  = '🛒 *Savatchangizda:*\n\n';
  cart.forEach((i, n) => {
    text += `${n + 1}. ${i.name} — ${i.price.toLocaleString()} so'm\n`;
  });
  text += `\n💰 *Jami: ${cartTotal(cart).toLocaleString()} so'm*`;

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback("✅ Buyurtma berish", 'order_start')],
    [Markup.button.callback("🗑 Tozalash",        'clear_cart') ],
  ]));
});

bot.action('clear_cart', (ctx) => {
  carts[ctx.from.id] = [];
  ctx.editMessageText("🗑 Savatcha tozalandi.");
});

// ============================================================
//  BUYURTMA JARAYONI
// ============================================================
bot.action('order_start', (ctx) => {
  ctx.reply(
    "📞 Telefon raqamingizni yuboring:",
    Markup.keyboard([[Markup.button.contactRequest('📞 Raqamni yuborish')]]).resize().oneTime()
  );
  ctx.answerCbQuery();
});

bot.on('contact', (ctx) => {
  users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
  ctx.reply(
    "📍 Lokatsiyangizni yuboring:",
    Markup.keyboard([[Markup.button.locationRequest('📍 Lokatsiyani yuborish')]]).resize().oneTime()
  );
});

bot.on('location', (ctx) => {
  const userId = ctx.from.id;
  const cart   = getCart(userId);
  if (!cart.length) return ctx.reply("Savatcha bo'sh. Avval taom tanlang.", mainKeyboard);

  users[userId] = {
    ...users[userId],
    latitude:  ctx.message.location.latitude,
    longitude: ctx.message.location.longitude,
  };

  ctx.reply(
    "💳 To'lov turini tanlang:",
    Markup.inlineKeyboard([
      [Markup.button.callback("💵 Naqd pul",      'pay_cash')],
      [Markup.button.callback("💳 Karta orqali",  'pay_card')],
    ])
  );
});

// --- Naqd ---
bot.action('pay_cash', async (ctx) => {
  const userId = ctx.from.id;
  const cart   = getCart(userId);
  if (!cart.length) return ctx.answerCbQuery("Savatcha bo'sh!");

  const orderId = String(orderCounter++);
  const total   = cartTotal(cart);

  orders[orderId] = {
    userId,
    phone:     users[userId]?.phone     || 'Noma\'lum',
    latitude:  users[userId]?.latitude,
    longitude: users[userId]?.longitude,
    items:     [...cart],
    total,
    payType:   'naqd',
    status:    'Yangi',
    lockCancel: false,
  };

  carts[userId] = [];
  await ctx.deleteMessage().catch(() => {});
  await ctx.reply(
    `✅ *Buyurtma #${orderId} qabul qilindi!*\n💵 Kuryerga naqd to'laysiz.`,
    { parse_mode: 'Markdown', ...mainKeyboard }
  );
  await sendOrderToAdmin(orderId);
});

// --- Karta ---
bot.action('pay_card', async (ctx) => {
  const userId = ctx.from.id;
  const cart   = getCart(userId);
  if (!cart.length) return ctx.answerCbQuery("Savatcha bo'sh!");

  const orderId = String(orderCounter++);
  const total   = cartTotal(cart);

  orders[orderId] = {
    userId,
    phone:     users[userId]?.phone     || 'Noma\'lum',
    latitude:  users[userId]?.latitude,
    longitude: users[userId]?.longitude,
    items:     [...cart],
    total,
    payType:   'karta',
    status:    'Yangi',
    lockCancel: false,
  };

  carts[userId] = [];
  await ctx.deleteMessage().catch(() => {});
  await ctx.replyWithMarkdown(
    `✅ *Buyurtma #${orderId} qabul qilindi!*\n\n` +
    `💳 *To'lov ma'lumotlari:*\n` +
    `🔢 Karta: \`${KARTA_RAQAM}\`\n` +
    `👤 Egasi: ${KARTA_EGASI}\n` +
    `💰 Summa: *${total.toLocaleString()} so'm*\n\n` +
    `⚠️ To'lovni amalga oshirgach, chekni *#${orderId}-buyurtma* deb adminga yuboring: ${ADMIN_USERNAME}`,
    mainKeyboard
  );
  await sendOrderToAdmin(orderId);
});

// ============================================================
//  MIJOZ — BUYURTMALARIM
// ============================================================
bot.hears('🗂 Buyurtmalarim', (ctx) => {
  const myOrders = Object.keys(orders).filter((id) => orders[id].userId === ctx.from.id);
  if (!myOrders.length) return ctx.reply("Sizda hozir faol buyurtma yo'q.");

  myOrders.forEach((id) => {
    const o    = orders[id];
    const text =
      `📦 *Buyurtma #${id}*\n` +
      `📋 ${o.items.map((i) => i.name).join(', ')}\n` +
      `💰 ${o.total.toLocaleString()} so'm\n` +
      `📊 *${o.status}*`;

    const keyboard = !o.lockCancel
      ? Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `u_cn_${id}`)]])
      : undefined;

    ctx.replyWithMarkdown(text, keyboard);
  });
});

// ============================================================
//  ADMIN ACTIONLARI
// ============================================================

// Tayyorlash (lock)
bot.action(/lock_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const o  = orders[id];
  if (!o) return ctx.answerCbQuery("Buyurtma topilmadi.");
  o.lockCancel = true;
  o.status     = 'Tayyorlanmoqda';
  await bot.telegram.sendMessage(
    o.userId,
    `👨‍🍳 Buyurtma #${id} tayyorlanmoqda! Endi bekor qila olmaysiz. 🔒`
  );
  await ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      COURIERS.map((c) => Markup.button.callback(`🚚 ${c.name}`, `ch_${id}_${c.id}`)),
      [Markup.button.callback("❌ Rad etish", `rej_${id}`)],
    ]).reply_markup
  );
  ctx.answerCbQuery("✅ Tayyorlanmoqda...");
});

// Kuryerga berish
bot.action(/ch_(.+)_(\d+)/, async (ctx) => {
  const orderId   = ctx.match[1];
  const courierId = parseInt(ctx.match[2], 10);
  const o         = orders[orderId];
  const courier   = COURIERS.find((c) => c.id === courierId);
  if (!o || !courier) return ctx.answerCbQuery("Xatolik.");

  o.status = 'Kuryerga berildi';
  const itemsList = o.items.map((i, n) => `${n + 1}. ${i.name}`).join('\n');

  try {
    await bot.telegram.sendMessage(
      courierId,
      `📦 *BUYURTMA #${orderId}*\n\n` +
      `📋 *Mahsulotlar:*\n${itemsList}\n\n` +
      `📞 Tel: +${o.phone}\n` +
      `💰 Summa: ${o.total.toLocaleString()} so'm`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ Qabul qildim",  `c_take_${orderId}`)],
          [Markup.button.callback("🏁 Topshirdim",    `c_done_${orderId}`)],
        ]),
      }
    );
    await bot.telegram.sendLocation(courierId, o.latitude, o.longitude);
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + `\n\n✅ ${courier.name}ga yuborildi.`
    );
    ctx.answerCbQuery(`${courier.name}ga yuborildi! ✅`);
  } catch {
    ctx.answerCbQuery("Xatolik! Kuryer botni ishga tushirmagan bo'lishi mumkin.", { show_alert: true });
  }
});

// Rad etish
bot.action(/rej_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const o  = orders[id];
  if (!o) return ctx.answerCbQuery("Buyurtma topilmadi.");
  await bot.telegram.sendMessage(o.userId, `❌ Buyurtma #${id} rad etildi. Kechirasiz.`);
  delete orders[id];
  ctx.editMessageText(`❌ #${id} rad etildi.`);
  ctx.answerCbQuery();
});

// Ko'p buyurtma ogohlantirishı
bot.action(/busy_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const o  = orders[id];
  if (!o) return ctx.answerCbQuery("Buyurtma topilmadi.");
  await bot.telegram.sendMessage(
    o.userId,
    "⏳ *Hurmatli mijoz!*\nHozirda buyurtmalar ko'p bo'lgani sababli tayyorlash biroz " +
    "ko'proq vaqt olishi mumkin. Tushunganingiz uchun rahmat! 😊",
    { parse_mode: 'Markdown' }
  );
  ctx.answerCbQuery("Mijoz ogohlantirildi! ✅");
});

// Mahsulot tugagan — ro'yxat
bot.action(/out_list_(.+)/, (ctx) => {
  const id = ctx.match[1];
  const o  = orders[id];
  if (!o) return ctx.answerCbQuery("Buyurtma topilmadi.");
  const btns = o.items.map((it, idx) => [
    Markup.button.callback(`❌ ${it.name} tugagan`, `c_out_${id}_${idx}`),
  ]);
  ctx.editMessageText("Tugagan mahsulotni tanlang:", Markup.inlineKeyboard(btns));
});

// Mahsulot tugagan — tanlov
bot.action(/c_out_(.+)_(\d+)/, async (ctx) => {
  const orderId = ctx.match[1];
  const idx     = parseInt(ctx.match[2], 10);
  const o       = orders[orderId];
  if (!o) return ctx.answerCbQuery("Buyurtma topilmadi.");

  const [removed] = o.items.splice(idx, 1);
  o.total -= removed.price;

  if (o.items.length > 0) {
    await bot.telegram.sendMessage(
      o.userId,
      `⚠️ Uzr, *${removed.name}* tugagan ekan.\nQolgan mahsulotlarni yuborisinmi?`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ Ha",    `u_y_${orderId}`)],
          [Markup.button.callback("❌ Yo'q",  `u_n_${orderId}`)],
        ]),
      }
    );
    ctx.editMessageText("✅ Mijozga so'rov yuborildi.");
  } else {
    await bot.telegram.sendMessage(
      o.userId,
      "⚠️ Barcha mahsulotlar tugaganligi sababli buyurtma bekor qilindi. Kechirasiz!"
    );
    delete orders[orderId];
    ctx.editMessageText("⚠️ Barcha mahsulotlar tugadi, buyurtma bekor qilindi.");
  }
  ctx.answerCbQuery();
});

bot.action(/u_y_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  await ctx.editMessageText("✅ Yangilangan buyurtma adminga yuborildi.");
  await sendOrderToAdmin(id);
  ctx.answerCbQuery();
});

bot.action(/u_n_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  if (orders[id]) {
    await bot.telegram.sendMessage(
      orders[id].userId,
      "🚫 Buyurtma bekor qilindi."
    );
    delete orders[id];
  }
  await bot.telegram.sendMessage(ADMIN_ID, `❌ Mijoz #${id} buyurtmadan voz kechdi.`);
  ctx.editMessageText("🚫 Bekor qilindi.");
  ctx.answerCbQuery();
});

// Mijoz tomonidan bekor qilish
bot.action(/u_cn_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const o  = orders[id];
  if (!o) return ctx.answerCbQuery("Buyurtma topilmadi.", { show_alert: true });
  if (o.lockCancel) return ctx.answerCbQuery("Bu buyurtmani bekor qilib bo'lmaydi!", { show_alert: true });

  await bot.telegram.sendMessage(
    ADMIN_ID,
    `⚠️ *Buyurtma #${id} mijoz tomonidan bekor qilindi!*`,
    { parse_mode: 'Markdown' }
  );
  delete orders[id];
  ctx.editMessageText("🚫 Buyurtma bekor qilindi.");
  ctx.answerCbQuery();
});

// ============================================================
//  KURYER ACTIONLARI
// ============================================================
bot.action(/c_take_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const o  = orders[id];
  if (!o) return ctx.answerCbQuery("Buyurtma topilmadi.");
  o.status = "Yo'lda 🚚";
  await bot.telegram.sendMessage(
    o.userId,
    "🚀 *Buyurtmangiz yo'lda!*\nKuryer qabul qildi va yo'lga chiqdi. 🚚",
    { parse_mode: 'Markdown' }
  );
  await ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([[Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]]).reply_markup
  );
  ctx.answerCbQuery("Mijozga xabar yuborildi! ✅");
});

bot.action(/c_done_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const o  = orders[id];
  if (!o) return ctx.answerCbQuery("Buyurtma topilmadi.");

  // Statistika
  stats.totalSum += o.total;
  o.items.forEach((i) => {
    stats.items[i.name] = (stats.items[i.name] || 0) + 1;
  });
  courierStats[ctx.from.id] = (courierStats[ctx.from.id] || 0) + 1;

  await bot.telegram.sendMessage(o.userId, "🏁 Buyurtmangiz yetkazildi! Rahmat, qayta kutamiz! 😊");
  await bot.telegram.sendMessage(ADMIN_ID, `✅ Buyurtma #${id} muvaffaqiyatli topshirildi!`);
  delete orders[id];
  ctx.editMessageText("🏁 Buyurtma yakunlandi.");
  ctx.answerCbQuery();
});

bot.hears('🏁 Topshirilgan buyurtmalarim', (ctx) => {
  const count = courierStats[ctx.from.id] || 0;
  ctx.reply(`📊 Bugun jami topshirilgan buyurtmalar: *${count} ta*`, { parse_mode: 'Markdown' });
});

bot.hears("🏠 Mijoz menyusiga o'tish", (ctx) => {
  ctx.reply("Asosiy menyuga o'tildi:", mainKeyboard);
});

// ============================================================
//  ISHGA TUSHIRISH
// ============================================================
bot.launch()
  .then(() => console.log('✅ Bot muvaffaqiyatli ishga tushdi!'))
  .catch((err) => {
    console.error('❌ Bot ishga tushmadi:', err.message);
    process.exit(1);
  });

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
