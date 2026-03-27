const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 
const MY_RENDER_URL = "https://my-telegram-bot-4x9n.onrender.com"; 

let orderCounter = 1; 

// --- STATISTIKA UCHUN (YANGI) ---
let stats = { totalSum: 0, items: {} };

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
let orders = {};
let users = {};

// 3. KLAVIATURA (O'ZGARTIRILDI: '🗂 Buyurtmalarim' QO'SHILDI)
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

// --- MIJOZ LOGIKASI ---

bot.start(ctx => {
    ctx.reply("Xush kelibsiz Coffee Food botiga! 👋", mainKeyboard);
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
    await ctx.answerCbQuery(`${item.name} savatchaga qo'shildi ✅`);
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

// --- YANGI: MIJOZ BUYURTMALARINI KO'RISH ---
bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const userId = ctx.from.id;
    const userOrders = Object.keys(orders).filter(id => orders[id].userId === userId && !orders[id].completed);
    
    if (userOrders.length === 0) return ctx.reply("Hozirda faol buyurtmalaringiz yo'q.");

    userOrders.forEach(id => {
        const order = orders[id];
        let itemsText = order.items.map(i => i.name).join(', ');
        let statusText = order.courierSent ? "🚗 Kuryer yo'lda" : "⏳ Tayyorlanmoqda";
        
        let text = `📦 *BUYURTMA #${id}*\n\n🍔 Taomlar: ${itemsText}\n💰 Jami: ${order.total} so'm\nStatus: ${statusText}`;
        
        // Agar kuryerga berilmagan bo'lsa, bekor qilish tugmasini chiqaramiz
        const keyboard = !order.courierSent ? 
            Markup.inlineKeyboard([[Markup.button.callback("🚫 Buyurtmani bekor qilish", `cancel_user_${id}`)]]) : null;
        
        ctx.replyWithMarkdown(text, keyboard);
    });
});

// MIJOZ TOMONIDAN BEKOR QILISH
bot.action(/cancel_user_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    
    if (!order) return ctx.answerCbQuery("Buyurtma topilmadi!");
    if (order.courierSent) return ctx.answerCbQuery("Kuryer yo'lga chiqqan, bekor qilib bo'lmaydi! 🚫", { show_alert: true });

    await ctx.telegram.sendMessage(ADMIN_ID, `⚠️ MIJOZ BUYURTMANI BEKOR QILDI: #${orderId}`);
    delete orders[orderId];
    ctx.editMessageText("🚫 Buyurtmangiz bekor qilindi.");
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

// --- BUYURTMA YUBORISH ---

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("Savatcha bo'sh");

    const { latitude, longitude } = ctx.message.location;
    const orderId = orderCounter.toString();
    orderCounter++; 

    let total = 0;
    cart.forEach(i => {
        total += i.price;
        // Statistika uchun hisoblash
        stats.items[i.name] = (stats.items[i.name] || 0) + 1;
    });
    stats.totalSum += total;

    orders[orderId] = { 
        userId, phone: users[userId].phone, latitude, longitude, 
        items: [...cart], total, courierSent: false, completed: false 
    };
    
    const mapLink = `https://www.google.com{latitude},${longitude}`;

    let itemsText = cart.map(i => `- ${i.name}`).join('\n');

    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `🔔 BUYURTMA #${orderId}\n\n📞 +${users[userId].phone}\n\n${itemsText}\n💰 Jami: ${total} so'm\n📍 Xarita: ${mapLink}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga berish", `sd_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)],
            [Markup.button.callback("📊 Kunlik Hisobot", "show_stats")] // Statistika tugmasi har bir buyurtmada chiqadi
        ])
    );

    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = [];
    ctx.reply("✅ Buyurtmangiz yuborildi. 'Buyurtmalarim' bo'limidan kuzatishingiz mumkin.", mainKeyboard);
});

// --- ADMIN STATISTIKA ---
bot.action('show_stats', (ctx) => {
    let text = "📊 *BUGUNGI HISOBOT:*\n\n";
    for (let name in stats.items) {
        text += `🔹 ${name}: ${stats.items[name]} ta\n`;
    }
    text += `\n💰 *JAMI TUSHUM:* ${stats.totalSum.toLocaleString()} so'm`;
    ctx.replyWithMarkdown(text);
    ctx.answerCbQuery();
});

// KURYERGA BERISH
bot.action(/sd_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageText("🚗 Kuryer tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = Number(ctx.match[2]);
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Xato!");

    order.courierSent = true; // Endi mijoz bekor qila olmaydi

    let text = order.items.map(i => `- ${i.name}`).join('\n');

    await ctx.telegram.sendMessage(courierId, `🚚 BUYURTMA #${orderId}\n📞 +${order.phone}\n${text}\n💰 Jami: ${order.total} so'm`);
    await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
    await ctx.telegram.sendMessage(order.userId, "🚀 Buyurtmangiz tayyor, kuryer yo'lda! Endi bekor qilib bo'lmaydi.", mainKeyboard);
    ctx.editMessageText("✅ Kuryerga yuborildi. Mijoz uchun bekor qilish yopildi.");
});

bot.action(/cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        await ctx.telegram.sendMessage(order.userId, "❌ Uzr, buyurtmangiz admin tomonidan bekor qilindi.", mainKeyboard);
    }
    delete orders[orderId];
    ctx.editMessageText("🚫 Buyurtma bekor qilindi");
});

bot.hears('📞 Aloqa', (ctx) => ctx.reply(`☕️ Coffee Food\n📞 +998 95 440 64 44\n⏰ 10:00 - 00:00`));

// --- SERVER VA SELF-PING ---
const app = express();
app.get('/', (req, res) => res.send("Bot Online 🚀"));
app.listen(process.env.PORT || 3000, '0.0.0.0');

setInterval(() => {
    axios.get(MY_RENDER_URL).then(() => console.log("Ping ✅")).catch(() => console.log("Xato ❌"));
}, 14 * 60 * 1000);

bot.launch().then(() => console.log("Coffee Food Bot ishga tushdi!"));
