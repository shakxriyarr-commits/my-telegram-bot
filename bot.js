const { Telegraf, Markup } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ADMIN VA KURYERLAR
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
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/add_(.+)/, (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    carts[userId].push({ ...item, uid: Date.now() + Math.random() });
    ctx.answerCbQuery(`${item?.name} qo‘shildi ✅`);
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
    ctx.reply("📱 Raqam yuborish uchun tugmani bosing:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqam")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiya yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiya")]]).resize().oneTime());
});

// BUYURTMA VA ADMINGA LOKATSIYA YUBORISH
bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("❗ Savatcha bo'sh");
    
    const { latitude, longitude } = ctx.message.location;
    const orderId = Date.now().toString();
    let itemsText = "";
    let total = 0;
    cart.forEach(i => { itemsText += `- ${i.name}\n`; total += i.price; });
    
    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total };
    
    const mapLink = `https://maps.google.com{latitude},${longitude}`;

    // ADMINGA XABAR
    await ctx.telegram.sendMessage(ADMIN_ID,
        `🔔 YANGI BUYURTMA #${orderId}\n\n📞 +${users[userId].phone}\n\n${itemsText}\n💰 Jami: ${total} so'm\n\n📍 Manzil: ${mapLink}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryer yuborish", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
        ])
    );
    
    // ADMINGA LOKATSIYA (XARITA)
    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    
    carts[userId] = [];
    ctx.reply("✅ Buyurtmangiz adminga yuborildi.", mainKeyboard);
});

// BEKOR QILISH (ADMIN)
bot.action(/cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        await ctx.telegram.sendMessage(order.userId, "❌ Uzr, buyurtmangiz rad etildi.", mainKeyboard);
        ctx.editMessageText(`🚫 Buyurtma #${orderId} bekor qilindi.`);
    }
});

// MAHSULOT TUGAGANINI TANLASH (ADMIN)
bot.action(/ed_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Topilmadi");
    const buttons = order.items.map(i => [Markup.button.callback(`❌ ${i.name} yo'q`, `rm_${orderId}_${i.uid}`)]);
    ctx.editMessageText("Qaysi mahsulot tugagan?", Markup.inlineKeyboard(buttons));
});

// MIJOZGA SO'ROV YUBORISH
bot.action(/rm_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const itemUid = Number(ctx.match[2]);
    const order = orders[orderId];
    if (!order) return;
    
    const removedItem = order.items.find(i => i.uid === itemUid);
    order.items = order.items.filter(i => i.uid !== itemUid);
    
    let newItems = "";
    let newTotal = 0;
    order.items.forEach(i => { newItems += `- ${i.name}\n`; newTotal += i.price; });
    order.total = newTotal;

    // MIJOZGA XABAR
    await ctx.telegram.sendMessage(order.userId, 
        `⚠️ Afsuski, "${removedItem.name}" tugabdi. Qolganlarini yuboraylikmi?\n\n${newItems}\n💰 Jami: ${newTotal} so'm`,
        Markup.inlineKeyboard([
            [Markup.button.callback("✅ Ha, yuboring", `ok_${orderId}`)],
            [Markup.button.callback("❌ Yo'q, bekor qilsin", `cn_${orderId}`)]
        ])
    );
    ctx.editMessageText(`✅ Mijozga "${removedItem.name}" tugagani haqida xabar yuborildi.`);
});

bot.action(/ok_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.editMessageText("✅ Tasdiqladingiz. Buyurtma tayyorlanmoqda.", mainKeyboard);
    await bot.telegram.sendMessage(ADMIN_ID, `✅ Mijoz qolgan mahsulotlarga rozi bo'ldi (#${orderId})`);
});

bot.action(/sd_(.+)/, (ctx) => {
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
        
        await ctx.telegram.sendMessage(courierId, `🚗 BUYURTMA #${orderId}\n📞 Tel: +${order.phone}\n${itemsText}\n💰 Jami: ${order.total}`);
        await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
        await ctx.telegram.sendMessage(order.userId, `🚀 Kuryer yo‘lda: ${courier.name}`, mainKeyboard);
        ctx.editMessageText(`✅ Buyurtma ${courier.name}ga berildi.`);
    } catch (e) { ctx.reply("Kuryerda xatolik!"); }
});

const app = express();
app.get('/', (req, res) => res.send("Bot 24/7 ishlashga tayyor 🚀"));
app.listen(process.env.PORT || 3000, '0.0.0.0');

bot.catch((err) => console.error('Xato:', err));
bot.launch();
