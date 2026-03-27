const { Telegraf, Markup } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ADMIN
const ADMIN_ID = 7312694067;

// KURYERLAR
const COURIERS = [
    { id: 111111111, name: "Ali" },
    { id: 222222222, name: "Vali" },
    { id: 333333333, name: "Sardor" },
    { id: 444444444, name: "Jasur" },
    { id: 555555555, name: "Bekzod" }
];

// MENU
const menu = [
    { id: 'b1', name: '🍔 Burger', price: 30000 },
    { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
    { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
    { id: 'l1', name: '🌯 Lavash', price: 32000 }
];

// DATA
let carts = {};
let orders = {};
let users = {};

// START
bot.start((ctx) => {
    ctx.reply("Xush kelibsiz 👋", Markup.keyboard([
        ['🍴 Menyu', '🛒 Savatcha'],
        ['📞 Aloqa']
    ]).resize());
});

// ALOQA
bot.hears('📞 Aloqa', (ctx) => {
    ctx.reply("📞 +998994506767");
});

// MENU
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [
        Markup.button.callback(`${i.name} - ${i.price}`, `add_${i.id}`)
    ]);
    ctx.reply("Tanlang:", Markup.inlineKeyboard(buttons));
});

// ADD TO CART
bot.action(/add_(.+)/, (ctx) => {
    const item = menu.find(i => i.id === ctx.match[1]);
    const userId = ctx.from.id;

    if (!carts[userId]) carts[userId] = [];
    carts[userId].push(item);

    ctx.answerCbQuery("Qo‘shildi ✅");
});

// CART
bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Bo‘sh 🛒");

    let text = "";
    let total = 0;

    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} - ${i.price}\n`;
        total += i.price;
    });

    text += `\n💰 ${total}`;

    ctx.reply(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma", "order")],
        [Markup.button.callback("🗑 Tozalash", "clear")]
    ]));
});

// CLEAR
bot.action('clear', (ctx) => {
    carts[ctx.from.id] = [];
    ctx.reply("Tozalandi 🗑");
});

// ORDER
bot.action('order', (ctx) => {
    ctx.reply("📱 Raqam yubor:", Markup.keyboard([
        [Markup.button.contactRequest("📞 Raqam")]
    ]).resize().oneTime());
});

// PHONE
bot.on('contact', (ctx) => {
    users[ctx.from.id] = {
        phone: ctx.message.contact.phone_number
    };

    ctx.reply("📍 Lokatsiya yubor:", Markup.keyboard([
        [Markup.button.locationRequest("📍 Lokatsiya")]
    ]).resize().oneTime());
});

// LOCATION
bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    const phone = users[userId]?.phone;

    if (!phone || !cart.length) return ctx.reply("❗ Xatolik");

    const { latitude, longitude } = ctx.message.location;
    const map = `https://maps.google.com/?q=${latitude},${longitude}`;

    const orderId = Date.now();

    let items = "";
    let total = 0;

    cart.forEach(i => {
        items += `- ${i.name}\n`;
        total += i.price;
    });

    orders[orderId] = {
        userId,
        phone,
        latitude,
        longitude,
        items,
        total,
        status: 'new'
    };

    // ADMIN
    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `🔔 BUYURTMA #${orderId}

📞 +${phone}

${items}

💰 ${total}

📍 ${map}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryer tanlash", `send_${orderId}`)]
        ])
    );

    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);

    carts[userId] = [];

    ctx.reply("✅ Yuborildi");
});

// ADMIN → KURYER TANLAYDI
bot.action(/send_(.+)/, (ctx) => {
    const orderId = ctx.match[1];

    const buttons = COURIERS.map(c => [
        Markup.button.callback(c.name, `choose_${orderId}_${c.id}`)
    ]);

    ctx.reply("Kuryer tanlang:", Markup.inlineKeyboard(buttons));
});

// KURYERGA YUBORISH
bot.action(/choose_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = Number(ctx.match[2]);

    const order = orders[orderId];
    if (!order) return;

    if (order.status === 'taken') {
        return ctx.answerCbQuery("❗ Olingan");
    }

    const courier = COURIERS.find(c => c.id === courierId);

    order.status = 'taken';

    await ctx.telegram.sendMessage(
        courier.id,
        `🚗 BUYURTMA #${orderId}

📞 +${order.phone}

${order.items}

💰 ${order.total}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("📦 Yetkazildi", `done_${orderId}`)]
        ])
    );

    await ctx.telegram.sendLocation(
        courier.id,
        order.latitude,
        order.longitude
    );

    await ctx.telegram.sendMessage(
        order.userId,
        `🚗 Kuryer yo‘lda: ${courier.name}`
    );

    ctx.editMessageReplyMarkup();
});

// DONE
bot.action(/done_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];

    await ctx.telegram.sendMessage(
        orders[orderId].userId,
        "📦 Yetkazildi 😋"
    );

    ctx.editMessageReplyMarkup();
});

// EXPRESS (RENDER UCHUN)
const app = express();
app.get('/', (req, res) => res.send("Bot ishlayapti 🚀"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server ishladi"));

bot.launch();
console.log("🚀 FULL BOT ISHLAYAPTI");
