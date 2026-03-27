const { Telegraf, Markup } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ADMIN VA SOZLAMALAR
const ADMIN_ID = 7312694067;
const COURIERS = [
    { id: 111111111, name: "Ali" },
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

const mainKeyboard = Markup.keyboard([['🍴 Menyu', '🛒 Savatcha'], ['📞 Aloqa']]).resize();

bot.start((ctx) => ctx.reply("Xush kelibsiz 👋", mainKeyboard));

bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [Markup.button.callback(`${i.name} - ${i.price}`, `add_${i.id}`)]);
    ctx.reply("Tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/add_(.+)/, (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    carts[userId].push({ ...item, uid: Date.now() + Math.random() });
    ctx.answerCbQuery(`${item.name} qo‘shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Bo‘sh 🛒");
    let text = "🛒 Savatchangiz:\n\n";
    let total = 0;
    cart.forEach((i, idx) => { text += `${idx + 1}. ${i.name} - ${i.price}\n`; total += i.price; });
    text += `\n💰 Jami: ${total} so'm`;
    ctx.reply(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma", "order")],
        [Markup.button.callback("🗑 Tozalash", "clear")]
    ]));
});

bot.action('clear', (ctx) => {
    carts[ctx.from.id] = [];
    ctx.editMessageText("Savatcha tozalandi 🗑");
});

bot.action('order', (ctx) => {
    ctx.reply("📱 Raqam yubor:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqam")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiya yubor:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiya")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("❗ Savatcha bo'sh");

    const { latitude, longitude } = ctx.message.location;
    const orderId = Date.now().toString();
    let itemsText = "";
    let total = 0;
    cart.forEach(i => { itemsText += `- ${i.name}\n`; total += i.price; });

    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total, status: 'new' };

    await ctx.telegram.sendMessage(ADMIN_ID,
        `🔔 BUYURTMA #${orderId}\n\n📞 +${users[userId].phone}\n\n${itemsText}\n💰 Jami: ${total} so'm`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryer tanlash", `send_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `edit_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `cancel_${orderId}`)]
        ])
    );
    carts[userId] = [];
    ctx.reply("✅ Buyurtmangiz yuborildi.", mainKeyboard);
});

// ADMIN BUTUNLAY BEKOR QILADI
bot.action(/cancel_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        await ctx.telegram.sendMessage(order.userId, "❌ Uzr, buyurtmangiz rad etildi.", mainKeyboard);
        ctx.editMessageText(`❌ Buyurtma #${orderId} bekor qilindi.`);
    }
});

// ADMIN QAYSI MAHSULOT YO'QLIGINI TANLAYDI
bot.action(/edit_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Buyurtma topilmadi");

    const buttons = order.items.map(i => [
        Markup.button.callback(`❌ ${i.name} yo'q`, `rm_${orderId}_${i.uid}`)
    ]);
    ctx.editMessageText("Tugagan mahsulotni tanlang:", Markup.inlineKeyboard(buttons));
});

// MAHSULOTNI OLIB TASHLASH VA MIJOZGA YUBORISH
bot.action(/rm_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const itemUid = Number(ctx.match[2]);
    const order = orders[orderId];
    if (!order) return;

    const removedItem = order.items.find(i => i.uid === itemUid);
    order.items = order.items.filter(i => i.uid !== itemUid);
    
    let newTotal = 0;
    let newItemsText = "";
    order.items.forEach(i => { newTotal += i.price; newItemsText += `- ${i.name}\n`; });
    order.total = newTotal;

    // Xabar aynan order.userId ga (Mijozga) boradi
    await ctx.telegram.sendMessage(order.userId, 
        `⚠️ Afsuski, hozirda "${removedItem.name}" qolmagan ekan.\n\nQolgan mahsulotlarni buyurtma qilasizmi?\n\n${newItemsText}\n💰 Jami: ${newTotal} so'm`,
        Markup.inlineKeyboard([
            [Markup.button.callback("✅ Ha, yuboring", `ok_new_${orderId}`)],
            [Markup.button.callback("❌ Yo'q, bekor qilsin", `cancel_${orderId}`)]
        ])
    );
    ctx.editMessageText(`✅ Mijozga "${removedItem.name}" yo'qligi haqida so'rov yuborildi.`);
});

bot.action(/ok_new_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    await ctx.telegram.sendMessage(ADMIN_ID, `✅ Mijoz qolgan mahsulotlarga rozi bo'ldi (#${orderId}). Kuryer tanlashingiz mumkin.`);
    ctx.editMessageText("✅ Tasdiqladingiz. Buyurtmangiz tayyorlanmoqda.", mainKeyboard);
});

bot.action(/send_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.reply("Kuryer tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = Number(ctx.match[2]);
    const order = orders[orderId];
    const courier = COURIERS.find(c => c.id === courierId);
    try {
        let itemsText = "";
        order.items.forEach(i => itemsText += `- ${i.name}\n`);
        await ctx.telegram.sendMessage(courierId, `🚗 BUYURTMA #${orderId}\n📞 +${order.phone}\n${itemsText}\n💰 Jami: ${order.total}`,
            Markup.inlineKeyboard([[Markup.button.callback("📦 Yetkazildi", `done_${orderId}`)]]));
        await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
        await ctx.telegram.sendMessage(order.userId, `🚀 Kuryer yo‘lda: ${courier.name}`, mainKeyboard);
        ctx.editMessageText(`✅ ${courier.name}ga topshirildi`);
    } catch (e) { ctx.reply("Kuryerda xatolik!"); }
});

bot.action(/done_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    if (orders[orderId]) {
        await ctx.telegram.sendMessage(orders[orderId].userId, "📦 Yetkazildi! Yoqimli ishtaha! 😋", mainKeyboard);
        ctx.editMessageText("📦 Yakunlandi");
    }
});

const app = express();
app.get('/', (req, res) => res.send("OK 🚀"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
bot.launch();
