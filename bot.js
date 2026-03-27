const { Telegraf, Markup } = require('telegraf');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 

let orderCounter = 1; 
let stats = { totalSum: 0, items: {} };

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Vali" }
];

const menu = [
    { id: 'b1', name: '🍔 Burger', price: 30000 },
    { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
    { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
    { id: 'l1', name: '🌯 Lavash', price: 32000 }
];

let carts = {};
let orders = {};
let users = {};

const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

// --- MIJOZ LOGIKASI ---
bot.start(ctx => ctx.reply("Xush kelibsiz Coffee Food botiga! 👋", mainKeyboard));

bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [Markup.button.callback(`${i.name} - ${i.price} so'm`, `add_${i.id}`)]);
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/add_(.+)/, async (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    carts[userId].push({ ...item, uid: Date.now() + Math.random() });
    await ctx.answerCbQuery(`${item.name} savatchaga qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo'sh 🛒");
    let text = "🛒 *Savatchangiz:*\n\n";
    let total = 0;
    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} - ${i.price} so'm\n`;
        total += i.price;
    });
    text += `\n💰 *Jami:* ${total.toLocaleString()} so'm`;
    ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

bot.action('order_start', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("📞 Raqamingizni yuborish uchun pastdagi tugmani bosing:", 
        Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime()
    );
});

bot.action('clear_cart', async (ctx) => {
    carts[ctx.from.id] = [];
    await ctx.answerCbQuery("Savatcha tozalandi");
    ctx.editMessageText("Savatcha tozalandi 🗑");
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiyangizni yuborish uchun pastdagi tugmani bosing:", 
        Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime()
    );
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("Savatcha bo'sh", mainKeyboard);

    const { latitude, longitude } = ctx.message.location;
    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    // Barcha ma'lumotlarni saqlaymiz
    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total, lockCancel: false, courierSent: false, addedToStats: false };

    const mapLink = `https://www.google.com{latitude},${longitude}`;
    const itemsText = cart.map(i => `- ${i.name}`).join('\n');

    await ctx.reply("✅ Buyurtmangiz qabul qilindi. Adminga yuborildi.", mainKeyboard);

    await ctx.telegram.sendMessage(ADMIN_ID, `🔔 *BUYURTMA #${orderId}*\n\n📞 +${users[userId].phone}\n${itemsText}\n💰 Jami: ${total.toLocaleString()} so'm\n📍 [Xaritada ko'rish](${mapLink})`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga", `sd_${orderId}`)],
            [Markup.button.callback("🔒 Bekorni yopish", `lock_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
        ])
    });
    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = []; 
});

bot.action(/lock_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        order.lockCancel = true;
        if (!order.addedToStats) {
            order.items.forEach(i => {
                stats.items[i.name] = (stats.items[i.name] || 0) + 1;
                stats.totalSum += i.price;
            });
            order.addedToStats = true;
        }
        await ctx.telegram.sendMessage(order.userId, `👨‍🍳 #${orderId} buyurtmangiz tayyorlanishni boshladi.`);
        ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga berish", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
        ]).reply_markup);
        ctx.answerCbQuery("Tasdiqlandi! ✅");
    }
});

bot.action(/ed_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Xato!");
    const buttons = order.items.map(i => [Markup.button.callback(`❌ ${i.name} tugagan`, `rm_${orderId}_${i.uid}`)]);
    ctx.editMessageText("Qaysi mahsulot tugagan?", Markup.inlineKeyboard(buttons));
});

bot.action(/rm_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const uid = ctx.match[2];
    const order = orders[orderId];
    if(!order) return;
    const item = order.items.find(i => i.uid == uid);
    order.items = order.items.filter(i => i.uid != uid);
    order.total = order.items.reduce((a, b) => a + b.price, 0);

    await ctx.telegram.sendMessage(order.userId, `⚠️ Uzr, "${item.name}" tugab qolgan ekan.\n\nQolganlari bilan yuboraveraylikmi?`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Ha", `re_ok_${orderId}`)],
        [Markup.button.callback("🚫 Yo'q", `u_cn_${orderId}`)]
    ]));
    ctx.editMessageText("Mijozga xabar yuborildi.");
});

// --- MANA SHU QISM MUAMMONI HAL QILADI ---
bot.action(/re_ok_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Buyurtma topilmadi!");

    await ctx.editMessageText("✅ Tasdiqladingiz. Rahmat!");

    const itemsText = order.items.map(i => `- ${i.name}`).join('\n');
    const mapLink = `https://www.google.com{order.latitude},${order.longitude}`;

    // Adminga barcha ma'lumotlarni qayta yuboramiz
    await ctx.telegram.sendMessage(ADMIN_ID, 
        `✅ *MIJOZ QOLGANIGA ROZI (#${orderId})*\n\n` +
        `📞 Telefon: +${order.phone}\n` +
        `🛍 *Qolgan mahsulotlar:*\n${itemsText}\n` +
        `💰 Yangi jami: ${order.total.toLocaleString()} so'm\n\n` +
        `📍 [Xaritada ko'rish](${mapLink})`, 
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("🚗 Kuryerga berish", `sd_${orderId}`)],
                [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
            ])
        }
    );
    await ctx.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
});

bot.action(/sd_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons).reply_markup);
});

bot.launch().then(() => console.log("Bot ishga tushdi!"));
