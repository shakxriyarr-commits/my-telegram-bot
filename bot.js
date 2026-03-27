const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 
const MY_RENDER_URL = "https://coffee-food-bot.onrender.com"; 

// 2. MA'LUMOTLAR
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
let orderCounter = 1; // Buyurtma sanog'ini 1 dan boshlaymiz
let users = {};

// 3. KLAVIATURA
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['📞 Aloqa']
]).resize();

// --- MIJOZ BOSHLANG'ICH QISMI ---

bot.start(ctx => {
    ctx.reply("Xush kelibsiz Coffee Food botiga! 👋\nLazzatli taomlarga buyurtma bering:", mainKeyboard);
});

bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [
        Markup.button.callback(`${i.name} - ${i.price} so'm`, `add_${i.id}`)
    ]);
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/add_(.+)/, async (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    carts[userId].push({ ...item, uid: Date.now() + Math.random() });
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo'sh 🛒");

    let text = "🛒 Savatchangiz:\n\n";
    let total = 0;
    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} - ${i.price} so'm\n`;
        total += i.price;
    });
    text += `\n💰 Jami: ${total} so'm`;

    ctx.reply(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order")],
        [Markup.button.callback("🗑 Tozalash", "clear")]
    ]));
});

bot.action('clear', async (ctx) => {
    carts[ctx.from.id] = [];
    await ctx.answerCbQuery();
    ctx.editMessageText("Savatcha tozalandi 🗑");
});

bot.action('order', (ctx) => {
    ctx.reply("📞 Raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiyangizni yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime());
});

// --- ADMINGA BUYURTMA YUBORISH ---

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("Savatcha bo'sh");
        const { latitude, longitude } = ctx.message.location;
    
    // YANGI TARTIBLI RAQAMLASH:
       // 1. Bazadan hozirgi raqamni olamiz
    const counterRes = await fetch(`${BASE_URL}/orderCounter.json`);
    let currentCounter = await counterRes.json();
    
    // Agar baza bo'sh bo'lsa 1 dan boshlaymiz
    if (!currentCounter) currentCounter = 1;

    const orderId = currentCounter.toString();

    // 2. Bazadagi raqamni keyingi safar uchun 1 taga oshirib qo'yamiz
    await fetch(`${BASE_URL}/orderCounter.json`, {
        method: "PUT",
        body: JSON.stringify(currentCounter + 1)
    });

    // Endi orderId tayyor (#1, #2...)


    // ... qolgan buyurtma saqlash kodi (orders[orderId] = ...)


    const { latitude, longitude } = ctx.message.location;
    const orderId = Date.now().toString().slice(-6);

    let itemsText = "";
    let total = 0;
    cart.forEach(i => {
        itemsText += `- ${i.name}\n`;
        total += i.price;
    });

    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total };
    const mapLink = `https://maps.google.com{latitude},${longitude}`;

    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `🔔 BUYURTMA #${orderId}\n\n📞 +${users[userId].phone}\n\n${itemsText}\n💰 Jami: ${total} so'm\n📍 Xarita: ${mapLink}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga berish", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
        ])
    );

    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = [];
    ctx.reply("✅ Buyurtmangiz qabul qilindi, admin tasdiqlashini kuting.", mainKeyboard);
});

// --- ADMIN VA KURYER FUNKSIYALARI ---

// Kuryer tanlash (Assign Courier)
bot.action(/sd_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    await ctx.answerCbQuery();
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageText(`🚗 Buyurtma #${orderId} uchun kuryer tanlang:`, Markup.inlineKeyboard(buttons));
});

// Kuryerga jo'natish (Dispatch)
bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = Number(ctx.match[2]);
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Xato: Buyurtma topilmadi!");

    let text = "";
    order.items.forEach(i => text += `- ${i.name}\n`);

    // Kuryerga xabar
    await ctx.telegram.sendMessage(courierId, `🚚 BUYURTMA #${orderId}\n📞 +${order.phone}\n${text}\n💰 Jami: ${order.total} so'm`);
    await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
    
    // Mijozga xabar
    await ctx.telegram.sendMessage(order.userId, "🚀 Buyurtmangiz tayyor bo'ldi va kuryerga berildi. Yo'lda!", mainKeyboard);
    
    await ctx.answerCbQuery("Kuryerga yuborildi ✅");
    ctx.editMessageText(`✅ Buyurtma #${orderId} kuryerga topshirildi.`);
});

// Bekor qilish (Cancel - Ham Adminga, ham Mijozga)
bot.action(/cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    await ctx.answerCbQuery();

    if (order) {
        // Mijozga xabar
        await ctx.telegram.sendMessage(order.userId, "❌ Uzr, buyurtmangiz bekor qilindi.", mainKeyboard).catch(()=>{});
        // Adminga (Sizga) xabar
        await ctx.telegram.sendMessage(ADMIN_ID, `🚫 Buyurtma #${orderId} bekor qilindi (Mijoz yoki Admin tomonidan).`);
    }
    ctx.editMessageText(`🚫 Buyurtma #${orderId} bekor qilindi.`);
});

// Mahsulot tugagan bo'lsa (Out of stock flow)
bot.action(/ed_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Xato!");
    
    const buttons = order.items.map(i => [Markup.button.callback(`❌ ${i.name} yo'q`, `rm_${orderId}_${i.uid}`)]);
    ctx.editMessageText("Qaysi mahsulot tugagan?", Markup.inlineKeyboard(buttons));
});

bot.action(/rm_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const uid = Number(ctx.match[2]);
    const order = orders[orderId];
    const removed = order.items.find(i => i.uid === uid);
    order.items = order.items.filter(i => i.uid !== uid);

    let text = ""; let total = 0;
    order.items.forEach(i => { text += `- ${i.name}\n`; total += i.price; });
    order.total = total;

    await ctx.telegram.sendMessage(order.userId, `⚠️ Uzr, "${removed.name}" tugab qolgan ekan.\n\nQolgan mahsulotlar:\n${text}\n💰 Jami: ${total} so'm\n\nYuboraveraylikmi?`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Ha, yuboring", `ok_${orderId}`)],
        [Markup.button.callback("❌ Yo'q, kerak emas", `cn_${orderId}`)]
    ]));
    ctx.editMessageText("Mijozga so'rov yuborildi...");
});

bot.action(/ok_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Xato!");

    await ctx.answerCbQuery("Tasdiqlandi ✅");
    ctx.editMessageText("✅ Rahmat! Buyurtmangiz qayta ishlanmoqda.");

    let itemsText = "";
    order.items.forEach(i => itemsText += `- ${i.name}\n`);
    const mapLink = `https://maps.google.com{order.latitude},${order.longitude}`;

    // Adminga qayta xabar (Kuryer tugmasi bilan)
    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `✅ MIJOZ QOLGANLARIGA ROZI (#${orderId})\n\n📞 +${order.phone}\n\n${itemsText}\n💰 Jami: ${order.total} so'm\n📍 Xarita: ${mapLink}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga berish", `sd_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
        ])
    );
    await ctx.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
});

bot.hears('📞 Aloqa', (ctx) => ctx.reply(`☕️ Coffee Food\n📞 +998 95 440 64 44\n⏰ 10:00 - 00:00`));

// --- SERVER VA SELF-PING ---
const app = express();
app.get('/', (req, res) => res.send("Coffee Food Bot is Running 🚀"));
app.listen(process.env.PORT || 3000, '0.0.0.0');

setInterval(() => {
    axios.get(MY_RENDER_URL).then(() => console.log("Uyg'oq ✅")).catch(() => console.log("Xato ❌"));
}, 14 * 60 * 1000);

bot.launch().then(() => console.log("Bot muvaffaqiyatli ishga tushdi 🚀"));
