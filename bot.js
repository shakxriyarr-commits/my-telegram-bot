const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ===== CONFIG =====
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067;

// ===== SERVER =====
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

// ===== DATA =====
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
    { id: 'l1', name: '🌯 Lavash', price: 32000 },
    { id: 'd1', name: '🥤 Cola', price: 10000 },
    { id: 's1', name: '🍰 Tort', price: 20000 }
];

let carts = {};
let orders = {};
let users = {};

// ===== KEYBOARDS =====
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
    ['🗑 Taomni o\'chirish', '📊 Kunlik hisobot'],
    ['🏠 Mijoz menyusiga o\'tish']
]).resize();

const courierKeyboard = Markup.keyboard([
    ['🏁 Topshirilgan buyurtmalarim'],
    ['🏠 Mijoz menyusiga o\'tish']
]).resize();

// ===== START =====
bot.start((ctx) => {
    const id = ctx.from.id;
    if (id === ADMIN_ID) return ctx.reply("Admin panel", adminKeyboard);
    if (COURIERS.some(c => c.id === id)) return ctx.reply("Kuryer panel", courierKeyboard);
    ctx.reply("Xush kelibsiz 👋", mainKeyboard);
});

// ===== MENU CATEGORY =====
bot.hears('🍴 Menyu', (ctx) => {
    ctx.reply("Kategoriya tanlang:", Markup.keyboard([
        ['🍔 Fastfood'],
        ['🥤 Ichimliklar'],
        ['🍰 Shirinliklar'],
        ['⬅️ Orqaga']
    ]).resize());
});

function getItems(type) {
    if (type === 'fastfood') return menu.filter(i => i.id.startsWith('b') || i.id.startsWith('l'));
    if (type === 'drinks') return menu.filter(i => i.id.startsWith('d'));
    if (type === 'sweets') return menu.filter(i => i.id.startsWith('s'));
}

function showMenu(ctx, type) {
    const items = getItems(type);
    const btns = items.map(i =>
        Markup.button.callback(`${i.name}\n${i.price}`, `add_${i.id}`)
    );
    ctx.reply("Tanlang:", Markup.inlineKeyboard(btns, { columns: 2 }));
}

bot.hears('🍔 Fastfood', ctx => showMenu(ctx, 'fastfood'));
bot.hears('🥤 Ichimliklar', ctx => showMenu(ctx, 'drinks'));
bot.hears('🍰 Shirinliklar', ctx => showMenu(ctx, 'sweets'));
bot.hears('⬅️ Orqaga', ctx => ctx.reply("Asosiy menyu:", mainKeyboard));

// ===== ADD =====
bot.action(/add_(.+)/, async (ctx) => {
    const item = menu.find(i => i.id === ctx.match[1]);
    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push(item);
    await ctx.answerCbQuery("Qo'shildi ✅");
});

// ===== CART =====
bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatcha bo'sh");

    let total = 0;
    let text = "🛒 Savatcha:\n";

    cart.forEach((i, idx) => {
        text += `${idx+1}. ${i.name} — ${i.price}\n`;
        total += i.price;
    });

    ctx.reply(text + "\n💰 Jami: " + total, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma", "order")],
        [Markup.button.callback("🗑 Tozalash", "clear")]
    ]));
});

bot.action('clear', ctx => {
    carts[ctx.from.id] = [];
    ctx.editMessageText("Tozalandi");
});

// ===== ORDER =====
bot.action('order', ctx => {
    ctx.reply("📞 Raqam yuboring", Markup.keyboard([
        [Markup.button.contactRequest("📞 Raqam")]
    ]).resize().oneTime());
});

bot.on('contact', ctx => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiya yuboring", Markup.keyboard([
        [Markup.button.locationRequest("📍 Lokatsiya")]
    ]).resize().oneTime());
});

bot.on('location', async ctx => {
    const id = ctx.from.id;
    const cart = carts[id];
    if (!cart || !cart.length) return;

    const total = cart.reduce((a,b)=>a+b.price,0);
    const orderId = orderCounter++;

    orders[orderId] = {
        userId: id,
        phone: users[id].phone,
        latitude: ctx.message.location.latitude,
        longitude: ctx.message.location.longitude,
        items: cart,
        total,
        status: 'Yangi',
        lockCancel: false
    };

    await ctx.reply(`✅ Buyurtma #${orderId} qabul qilindi`, mainKeyboard);
    await sendOrderToAdmin(orderId);

    carts[id] = [];
});

// ===== BUYURTMALARIM =====
bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const my = Object.keys(orders).filter(id => orders[id].userId === ctx.from.id);

    if (!my.length) return ctx.reply("Buyurtma yo'q");

    my.forEach(id => {
        const o = orders[id];

        const btn = !o.lockCancel
            ? Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `cancel_${id}`)]])
            : null;

        ctx.reply(`#${id}\n${o.items.map(i=>i.name).join(', ')}\n📊 ${o.status}`, btn);
    });
});

// ===== CANCEL =====
bot.action(/cancel_(.+)/, async ctx => {
    const id = ctx.match[1];
    if (!orders[id]) return;

    if (!orders[id].lockCancel) {
        await bot.telegram.sendMessage(ADMIN_ID, `❌ Mijoz bekor qildi (#${id})`);
        delete orders[id];
        ctx.editMessageText("Bekor qilindi");
    }
});

// ===== ADMIN SEND =====
async function sendOrderToAdmin(id) {
    const o = orders[id;

    await bot.telegram.sendMessage(ADMIN_ID,
        `🆕 #${id}\n${o.items.map(i=>i.name).join(', ')}\n💰 ${o.total}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("👨‍🍳 Tayyorlash", `lock_${id}`)],
            [Markup.button.callback("❌ Rad", `rej_${id}`)],
            [Markup.button.callback("⚠️ Tugagan", `out_${id}`)],
            [Markup.button.callback("⏳ Kutish", `busy_${id}`)]
        ])
    );

    await bot.telegram.sendLocation(ADMIN_ID, o.latitude, o.longitude);
}

// ===== ADMIN ACTION =====
bot.action(/lock_(.+)/, ctx => {
    const id = ctx.match[1];
    const o = orders[id];

    o.lockCancel = true;
    o.status = "Tayyorlanmoqda";

    const btns = COURIERS.map(c =>
        [Markup.button.callback(c.name, `ch_${id}_${c.id}`)]
    );

    ctx.editMessageText("Kuryer tanlang:", Markup.inlineKeyboard(btns));
});

bot.action(/busy_(.+)/, ctx => {
    bot.telegram.sendMessage(orders[ctx.match[1]].userId,
        "⏳ Buyurtma ko‘p, kuting");
});

bot.action(/out_(.+)/, ctx => {
    bot.telegram.sendMessage(orders[ctx.match[1]].userId,
        "⚠️ Mahsulot tugagan");
});

// ===== COURIER =====
bot.action(/ch_(.+)_(.+)/, ctx => {
    const [_, id, cid] = ctx.match;
    const o = orders[id];

    o.status = "Yo‘lda 🚚";

    bot.telegram.sendMessage(cid,
        `📦 #${id}\n${o.items.map(i=>i.name).join(', ')}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("✅ Qabul qildim", `c_take_${id}`)],
            [Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]
        ])
    );

    bot.telegram.sendLocation(cid, o.latitude, o.longitude);
});

bot.action(/c_take_(.+)/, async ctx => {
    const id = ctx.match[1];
    await bot.telegram.sendMessage(orders[id].userId, "🚚 Yo‘lda");
    await bot.telegram.sendMessage(ADMIN_ID, `🚚 Kuryer oldi (#${id})`);
});

bot.action(/c_done_(.+)/, async ctx => {
    const id = ctx.match[1];
    const o = orders[id];

    await bot.telegram.sendMessage(o.userId, "🏁 Yetkazildi");
    await bot.telegram.sendMessage(ADMIN_ID, `✅ Yetkazildi (#${id})`);

    stats.totalSum += o.total;
    courierStats[ctx.from.id] = (courierStats[ctx.from.id] || 0) + 1;

    delete orders[id];
});

// ===== HISOBOT =====
bot.hears('📊 Kunlik hisobot', ctx => {
    if (ctx.from.id !== ADMIN_ID) return;

    let text = `💰 Jami: ${stats.totalSum}\n`;
    for (let k in stats.items) {
        text += `${k}: ${stats.items[k]}\n`;
    }

    ctx.reply(text);
});

// ===== LAUNCH =====
bot.launch({ dropPendingUpdates: true });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
