const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 
const MY_RENDER_URL = "https://my-telegram-bot-4x9n.onrender.com"; 

let orderCounter = 1; 
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

// 3. KLAVIATURA
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
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)],
            [Markup.button.callback("📊 Hisobot", "show_stats")]
        ])
    });
    
    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = []; 
});

bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const userId = ctx.from.id;
    const userOrders = Object.keys(orders).filter(id => orders[id].userId === userId);
    
    if (userOrders.length === 0) return ctx.reply("Hozirda faol buyurtmalaringiz yo'q.");

    userOrders.forEach(id => {
        const o = orders[id];
        let status = o.courierSent ? "🚗 Yo'lda" : (o.lockCancel ? "👨‍🍳 Tayyorlanmoqda" : "⏳ Qabul qilindi");
        const kb = (!o.lockCancel && !o.courierSent) ? Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `u_cn_${id}`)]]) : null;
        ctx.replyWithMarkdown(`📦 *BUYURTMA #${id}*\n💰: ${o.total.toLocaleString()} so'm\nStatus: ${status}`, kb);
    });
});

bot.action(/u_cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    if (orders[orderId] && !orders[orderId].lockCancel) {
        await ctx.telegram.sendMessage(ADMIN_ID, `⚠️ MIJOZ BEKOR QILDI: #${orderId}`);
        delete orders[orderId];
        ctx.editMessageText("🚫 Buyurtmangiz bekor qilindi.");
    } else ctx.answerCbQuery("Bekor qilib bo'lmaydi! 🚫");
});

bot.action('show_stats', (ctx) => {
    let text = "📊 *BUGUNGI HISOBOT (Tasdiqlanganlar):*\n\n";
    if (Object.keys(stats.items).length === 0) text += "Hozircha sotuvlar yo'q.";
    for (let name in stats.items) text += `🔹 ${name}: ${stats.items[name]} ta\n`;
    text += `\n💰 *JAMI TUSHUM:* ${stats.totalSum.toLocaleString()} so'm`;
    ctx.replyWithMarkdown(text);
    ctx.answerCbQuery();
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
        await ctx.telegram.sendMessage(order.userId, `👨‍🍳 #${orderId} buyurtmangiz tayyorlanishni boshladi. Endi bekor qilib bo'lmaydi.`);
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

bot.action(/re_ok_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.editMessageText("✅ Tasdiqladingiz. Rahmat!");
    await ctx.telegram.sendMessage(ADMIN_ID, `✅ MIJOZ ROZI (#${orderId}).`);
});

bot.action(/sd_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageText("🚗 Kuryer tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = Number(ctx.match[2]);
    const order = orders[orderId];
    if (!order) return;
    order.courierSent = true; order.lockCancel = true;
    
    if (!order.addedToStats) {
        order.items.forEach(i => { stats.items[i.name] = (stats.items[i.name] || 0) + 1; stats.totalSum += i.price; });
        order.addedToStats = true;
    }

    await ctx.telegram.sendMessage(courierId, `🚚 *BUYURTMA #${orderId}*\n📞 +${order.phone}\n💰 Jami: ${order.total.toLocaleString()} so'm`, { parse_mode: 'Markdown' });
    await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
    await ctx.telegram.sendMessage(order.userId, "🚀 Buyurtmangiz kuryerga berildi, yo'lda!", mainKeyboard);
    ctx.editMessageText("✅ Kuryerga yuborildi");
});

bot.hears('📞 Aloqa', (ctx) => ctx.reply(`☕️ Coffee Food\n📞 +998 95 440 64 44`));

// --- SERVER ---
const app = express();
app.get('/', (req, res) => res.send("Bot Online 🚀"));
app.listen(process.env.PORT || 3000, '0.0.0.0');

setInterval(() => { axios.get(MY_RENDER_URL).catch(() => {}); }, 14 * 60 * 1000);
bot.launch().then(() => console.log("Bot ishga tushdi!"));
