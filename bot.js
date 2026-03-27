const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

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

// 2. KLAVIATURALAR
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['📊 Kunlik hisobot', '📦 Faol buyurtmalar'],
    ['🏠 Mijoz menyusiga o\'tish']
]).resize();

const courierKeyboard = Markup.keyboard([
    ['🏁 Topshirilgan buyurtmalarim'],
    ['🏠 Mijoz menyusiga o\'tish']
]).resize();

// --- START ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) {
        ctx.reply("Xush kelibsiz, Admin! 🛠", adminKeyboard);
    } else if (COURIERS.some(c => c.id === userId)) {
        ctx.reply("Xush kelibsiz, Kuryer! 🚗", courierKeyboard);
    } else {
        ctx.reply("Xush kelibsiz Coffee Food botiga! 👋", mainKeyboard);
    }
});

bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz rejimi:", mainKeyboard));

// --- KURYER STATISTIKASI ---
bot.hears('🏁 Topshirilgan buyurtmalarim', (ctx) => {
    const courierId = ctx.from.id;
    let count = 0;
    // Stats ichidan ushbu kuryerga tegishli yakunlanganlarni hisoblash mantiqi (ixtiyoriy saqlash mumkin)
    ctx.reply(`Siz bugun muvaffaqiyatli topshirgan buyurtmalar soni tizimda saqlanmoqda. ✅`);
});

// --- ADMIN HISOBOT ---
bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    let text = "📊 *BUGUNGI HISOBOT:*\n\n";
    if (Object.keys(stats.items).length === 0) text += "Hozircha sotuvlar yo'q.";
    for (let name in stats.items) text += `🔹 ${name}: ${stats.items[name]} ta\n`;
    text += `\n💰 *JAMI TUSHUM:* ${stats.totalSum.toLocaleString()} so'm`;
    ctx.replyWithMarkdown(text);
});

bot.hears('📦 Faol buyurtmalar', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const activeOrders = Object.keys(orders).filter(id => !orders[id].courierSent);
    if (activeOrders.length === 0) return ctx.reply("Hozirda yangi buyurtmalar yo'q. ✅");
    ctx.reply(`Hozirda ${activeOrders.length} ta faol buyurtma bor.`);
});

// --- MIJOZ BEKOR QILISH (TUZATILGAN) ---
bot.action(/u_cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];

    if (!order) return ctx.answerCbQuery("Buyurtma topilmadi!");

    // AGAR ADMIN BLOKLAGAN BO'LSA (Eski xabardagi tugmani bossa ham ishlamaydi)
    if (order.lockCancel) {
        await ctx.answerCbQuery("❌ Kechirasiz, buyurtma tayyorlanishni boshladi, endi bekor qilib bo'lmaydi!", { show_alert: true });
        return ctx.editMessageReplyMarkup(null); // Tugmani o'chirib tashlaymiz
    }

    // Mijoz "Yo'q" desa adminga xabar borishi
    await ctx.telegram.sendMessage(ADMIN_ID, `⚠️ *BUYURTMA RAD ETILDI (#${orderId})*\nMijoz mahsulot tugagani sababli yoki o'z xohishi bilan bekor qildi.`, { parse_mode: 'Markdown' });
    
    delete orders[orderId];
    await ctx.editMessageText("🚫 Buyurtmangiz bekor qilindi.");
});

// --- ADMIN LOCK (QULFLASH) ---
bot.action(/lock_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        order.lockCancel = true;
        await ctx.telegram.sendMessage(order.userId, `👨‍🍳 Buyurtma #${orderId} tayyorlanishni boshladi. Endi uni bekor qilib bo'lmaydi! 🔒`);
        ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)]
        ]).reply_markup);
        ctx.answerCbQuery("Bekor qilish bloklandi! ✅");
    }
});

// --- KURYERGA TOPSHIRISH ---
bot.action(/sd_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageText("Kuryerni tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = ctx.match[2];
    const order = orders[orderId];
    if (!order) return;
    
    await ctx.telegram.sendMessage(courierId, `📦 YANGI BUYURTMA #${orderId}\n📞 +${order.phone}\n💰 ${order.total.toLocaleString()}`, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ Qabul qildim", `c_take_${orderId}`)],
            [Markup.button.callback("🏁 Topshirdim", `c_done_${orderId}`)]
        ])
    });
    await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
    ctx.editMessageText(`✅ #${orderId} kuryerga yuborildi.`);
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        order.courierSent = true;
        await ctx.telegram.sendMessage(order.userId, `🚀 Kuryer buyurtmangizni qabul qildi va yo'lga chiqdi!`);
        ctx.answerCbQuery("Mijozga xabar boradi!");
    }
});

bot.action(/c_done_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        if (!order.addedToStats) {
            order.items.forEach(i => {
                stats.items[i.name] = (stats.items[i.name] || 0) + 1;
                stats.totalSum += i.price;
            });
            order.addedToStats = true;
        }
        await ctx.telegram.sendMessage(order.userId, `🏁 Buyurtmangiz yetkazildi. Yoqimli ishtaha! 👋`);
        await ctx.telegram.sendMessage(ADMIN_ID, `✅ #${orderId} muvaffaqiyatli topshirildi.`);
        ctx.editMessageText(`🏁 Buyurtma #${orderId} yakunlandi.`);
        delete orders[orderId];
    }
});

// --- MENYU VA BOSHQA STANDARTLAR ---
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
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
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
    await ctx.reply("📞 Raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiyangizni yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("Savatcha bo'sh");
    const { latitude, longitude } = ctx.message.location;
    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);
    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total, lockCancel: false, courierSent: false, addedToStats: false };
    
    await ctx.reply("✅ Buyurtmangiz qabul qilindi.", mainKeyboard);
    const itemsText = cart.map(i => `- ${i.name}`).join('\n');
    await ctx.telegram.sendMessage(ADMIN_ID, `🔔 *BUYURTMA #${orderId}*\n\n📞 +${users[userId].phone}\n${itemsText}\n💰 ${total.toLocaleString()}\n📍 [Xarita](https://www.google.com{latitude},${longitude})`, {
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

bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const userId = ctx.from.id;
    const userOrders = Object.keys(orders).filter(id => orders[id].userId === userId);
    if (userOrders.length === 0) return ctx.reply("Hozirda faol buyurtmalaringiz yo'q.");
    userOrders.forEach(id => {
        const o = orders[id];
        const status = o.courierSent ? "🚗 Yo'lda" : (o.lockCancel ? "👨‍🍳 Tayyorlanmoqda" : "⏳ Qabul qilindi");
        const kb = (!o.lockCancel && !o.courierSent) ? Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `u_cn_${id}`)]]) : null;
        ctx.replyWithMarkdown(`📦 *BUYURTMA #${id}*\nStatus: ${status}`, kb);
    });
});

bot.action(/ed_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    const buttons = order.items.map(i => [Markup.button.callback(`❌ ${i.name} tugagan`, `rm_${orderId}_${i.uid}`)]);
    ctx.editMessageText("Qaysi mahsulot tugagan?", Markup.inlineKeyboard(buttons));
});

bot.action(/rm_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const uid = ctx.match[2];
    const order = orders[orderId];
    const item = order.items.find(i => i.uid == uid);
    order.items = order.items.filter(i => i.uid != uid);
    order.total = order.items.reduce((a, b) => a + b.price, 0);
    await ctx.telegram.sendMessage(order.userId, `⚠️ "${item.name}" tugagan. Qolganlarini yuboraveraylikmi?`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Ha", `re_ok_${orderId}`)],
        [Markup.button.callback("🚫 Yo'q", `u_cn_${orderId}`)]
    ]));
    ctx.editMessageText("Mijozga so'rov yuborildi.");
});

bot.action(/re_ok_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return;
    ctx.editMessageText("✅ Mijoz tasdiqladi.");
    await ctx.telegram.sendMessage(ADMIN_ID, `✅ *MIJOZ ROZI (#${orderId})*\n📞 +${order.phone}\n💰 ${order.total.toLocaleString()}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("🚗 Kuryerga", `sd_${orderId}`)], [Markup.button.callback("🔒 Bekorni yopish", `lock_${orderId}`)]])
    });
});

bot.action(/cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        await ctx.telegram.sendMessage(order.userId, `🚫 Uzr, buyurtmangiz #${orderId} admin tomonidan bekor qilindi.`);
        delete orders[orderId];
        ctx.editMessageText(`🚫 #${orderId} bekor qilindi.`);
    }
});

bot.launch().then(() => console.log("Bot ishlamoqda..."));
