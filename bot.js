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
let courierStats = {}; 
let adminState = {}; 

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Vali" }
];

let menu = [
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
    ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
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
    if (userId === ADMIN_ID) ctx.reply("Admin panelga xush kelibsiz! 🛠", adminKeyboard);
    else if (COURIERS.some(c => c.id === userId)) ctx.reply("Kuryer paneliga xush kelibsiz! 🚗", courierKeyboard);
    else ctx.reply("Xush kelibsiz Coffee Food botiga! 👋", mainKeyboard);
});

// --- MIJOZ MENYU (2 QATORLI) ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => Markup.button.callback(`${i.name}\n${i.price.toLocaleString()} so'm`, `add_${i.id}`));
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons, { columns: 2 }));
});

bot.action(/add_(.+)/, async (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push({ ...item });
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
});

// --- BUYURTMA BERISH ---
bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return;
    const { latitude, longitude } = ctx.message.location;
    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);
    
    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total, status: 'Kutilmoqda', lockCancel: false };
    
    await ctx.reply(`✅ Buyurtmangiz qabul qilindi (#${orderId}).`, Markup.inlineKeyboard([
        [Markup.button.callback("🚫 Buyurtmani bekor qilish", `u_cn_${orderId}`)]
    ]));
    
    let itemsText = cart.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
    await ctx.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n\n📋 *Tarkibi:*\n${itemsText}\n\n💰 Jami: ${total.toLocaleString()} so'm`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("👨‍🍳 Tayyorlash", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `rej_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${orderId}`)]
        ])
    });
    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = [];
});

// --- ADMIN: MAHSULOT TUGAGAN (TUGMALAR BILAN) ---
bot.action(/out_list_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        // Savatchadagi mahsulotlarni tugma qilib chiqarish
        const buttons = order.items.map((item, idx) => [
            Markup.button.callback(`❌ ${item.name} tugagan`, `out_fin_${orderId}_${idx}`)
        ]);
        ctx.editMessageText(`Buyurtma #${orderId} uchun qaysi mahsulot tugaganligini tanlang:`, Markup.inlineKeyboard(buttons));
    }
});

bot.action(/out_fin_(.+)_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const itemIdx = ctx.match[2];
    const order = orders[orderId];
    
    if (order) {
        const outItemName = order.items[itemIdx].name;
        bot.telegram.sendMessage(order.userId, `⚠️ Kechirasiz, buyurtmangizda *${outItemName}* tugab qolganligi sababli buyurtma bekor qilindi.`, { parse_mode: 'Markdown' });
        delete orders[orderId];
        ctx.editMessageText(`✅ #${orderId} buyurtma "${outItemName} tugagan" deb bekor qilindi.`);
    }
});

// --- KURYER STATISTIKASI ---
bot.hears('🏁 Topshirilgan buyurtmalarim', (ctx) => {
    const count = courierStats[ctx.from.id] || 0;
    ctx.reply(`✅ Siz bugun jami *${count} ta* buyurtmani topshirdingiz.`, { parse_mode: 'Markdown' });
});

bot.action(/c_done_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const order = orders[id];
    if (order) {
        stats.totalSum += order.total;
        courierStats[ctx.from.id] = (courierStats[ctx.from.id] || 0) + 1;
        bot.telegram.sendMessage(order.userId, `🏁 Buyurtmangiz yetkazildi. Yoqimli ishtaha! 👋`);
        ctx.editMessageText(`🏁 #${id} yakunlandi. Jami topshirganingiz: ${courierStats[ctx.from.id]} ta`);
        delete orders[id];
    }
});

// --- BEKOR QILISH (MIJOZ) ---
bot.action(/u_cn_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        if (orders[id].lockCancel) return ctx.answerCbQuery("❌ Buyurtma tayyorlanmoqda, bekor qilib bo'lmaydi!", { show_alert: true });
        delete orders[id];
        ctx.editMessageText("🚫 Buyurtmangiz bekor qilindi.");
    }
});

// QOLGAN BARCHA ASLIY KODLAR (Kuryerga berish, Taom qo'shish va h.k.) JOYLARIDA QOLDI...

bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].lockCancel = true;
        orders[id].status = 'Tayyorlanmoqda';
        bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtma #${id} tayyorlanmoqda!`);
        ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga", `sd_${id}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${id}`)]
        ]).reply_markup);
    }
});

bot.action(/sd_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${id}_${c.id}`)]);
    ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons).reply_markup);
});

bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const [_, id, cId] = ctx.match;
    if (orders[id]) {
        orders[id].status = 'Yo\'lda';
        bot.telegram.sendMessage(cId, `📦 BUYURTMA #${id}\n💰 ${orders[id].total} so'm`, Markup.inlineKeyboard([[Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]]));
        bot.telegram.sendLocation(cId, orders[id].latitude, orders[id].longitude);
        ctx.editMessageText(`✅ #${id} kuryerga yuborildi.`);
    }
});

bot.launch();
