const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ===== SETTINGS =====
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067;

// ===== SERVER (RENDER) =====
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

// ===== DATA =====
let orderCounter = 1;
let stats = { totalSum: 0, items: {} };
let courierStats = {};
let adminState = {};

let carts = {};
let orders = {};
let users = {};

// ===== COURIERS =====
const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Vali" }
];

// ===== MENU (CATEGORY) =====
let menu = {
    fastfood: [
        { id: 'b1', name: '🍔 Burger', price: 30000 },
        { id: 'b2', name: '🍔 Double Burger', price: 35000 },
        { id: 'l1', name: '🌯 Lavash', price: 32000 }
    ],
    drinks: [
        { id: 'd1', name: '🥤 Cola', price: 10000 },
        { id: 'd2', name: '🧃 Sharbat', price: 12000 }
    ],
    sweets: [
        { id: 's1', name: '🍰 Tort', price: 20000 }
    ]
};

function getAllItems() {
    return Object.values(menu).flat();
}

// ===== KEYBOARDS =====
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
    ['📊 Hisobot', '📦 Faol buyurtmalar']
]).resize();

const courierKeyboard = Markup.keyboard([
    ['🏁 Topshirilgan buyurtmalarim']
]).resize();

// ===== START =====
bot.start((ctx) => {
    const id = ctx.from.id;
    if (id === ADMIN_ID) ctx.reply("Admin panel", adminKeyboard);
    else if (COURIERS.some(c => c.id === id)) ctx.reply("Kuryer panel", courierKeyboard);
    else ctx.reply("Xush kelibsiz 👋", mainKeyboard);
});

// ===== MENU =====
bot.hears('🍴 Menyu', (ctx) => {
    ctx.reply("Kategoriya tanlang:", Markup.keyboard([
        ['🍔 Fastfood'],
        ['🥤 Ichimliklar'],
        ['🍰 Shirinliklar'],
        ['⬅️ Orqaga']
    ]).resize());
});

function showCategory(ctx, category) {
    const buttons = menu[category].map(i =>
        Markup.button.callback(`${i.name}\n${i.price.toLocaleString()} so'm`, `add_${i.id}`)
    );
    ctx.reply("Tanlang:", Markup.inlineKeyboard(buttons, { columns: 2 }));
}

bot.hears('🍔 Fastfood', (ctx) => showCategory(ctx, 'fastfood'));
bot.hears('🥤 Ichimliklar', (ctx) => showCategory(ctx, 'drinks'));
bot.hears('🍰 Shirinliklar', (ctx) => showCategory(ctx, 'sweets'));

bot.hears('⬅️ Orqaga', (ctx) => ctx.reply("Menu:", mainKeyboard));

// ===== ADD TO CART =====
bot.action(/add_(.+)/, async (ctx) => {
    const id = ctx.match[1];

    let item;
    for (let cat in menu) {
        item = menu[cat].find(i => i.id === id);
        if (item) break;
    }

    if (!item) return;

    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push({ ...item });

    ctx.answerCbQuery(`${item.name} qo'shildi`);
});

// ===== CART =====
bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Bo'sh");

    let total = 0;
    let text = "🛒:\n";

    cart.forEach((i, idx) => {
        text += `${idx+1}. ${i.name}\n`;
        total += i.price;
    });

    ctx.reply(`${text}\n💰 ${total}`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear")]
    ]));
});

bot.action('clear', (ctx) => {
    carts[ctx.from.id] = [];
    ctx.editMessageText("Tozalandi");
});

// ===== ORDER =====
bot.action('order_start', (ctx) => {
    ctx.reply("📞 Raqam yuboring", Markup.keyboard([
        [Markup.button.contactRequest("📞 Yuborish")]
    ]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };

    ctx.reply("📍 Lokatsiya yuboring", Markup.keyboard([
        [Markup.button.locationRequest("📍 Yuborish")]
    ]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const id = ctx.from.id;
    const cart = carts[id] || [];
    if (!cart.length) return;

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

    if (!my.length) return ctx.reply("Yo'q");

    my.forEach(id => {
        const o = orders[id];

        let text = `📦 #${id}\n${o.items.map(i=>i.name).join(', ')}\n💰 ${o.total}\n📊 ${o.status}`;

        const btn = !o.lockCancel
            ? Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `u_cn_${id}`)]])
            : null;

        ctx.reply(text, btn);
    });
});

// ===== CANCEL =====
bot.action(/u_cn_(.+)/, async (ctx) => {
    const id = ctx.match[1];

    if (!orders[id]) return;

    if (orders[id].lockCancel)
        return ctx.answerCbQuery("Bekor qilib bo'lmaydi!");

    await bot.telegram.sendMessage(ADMIN_ID, `❌ #${id} bekor qilindi`);

    delete orders[id];
    ctx.editMessageText("Bekor qilindi");
});

// ===== ADMIN → ORDER =====
async function sendOrderToAdmin(id) {
    const o = orders[id];

    await bot.telegram.sendMessage(ADMIN_ID,
        `🆕 #${id}\n${o.items.map(i=>i.name).join(', ')}\n💰 ${o.total}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("👨‍🍳 Tayyorlash", `lock_${id}`)],
            [Markup.button.callback("❌ Rad", `rej_${id}`)]
        ])
    );

    await bot.telegram.sendLocation(ADMIN_ID, o.latitude, o.longitude);
}

// ===== ADMIN ACTION =====
bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    const o = orders[id];

    if (!o) return;

    o.lockCancel = true;
    o.status = 'Tayyorlanmoqda';

    await bot.telegram.sendMessage(o.userId, "👨‍🍳 Tayyorlanmoqda");

    // 👉 KURYERGA O‘TKAZISH
    const buttons = COURIERS.map(c =>
        [Markup.button.callback(c.name, `ch_${id}_${c.id}`)]
    );

    ctx.editMessageText("Kuryerni tanlang:", Markup.inlineKeyboard(buttons));
});

// ===== KURYER TANLASH =====
bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const [_, id, cid] = ctx.match;
    const o = orders[id];

    if (!o) return;

    o.status = 'Kuryerga berildi';

    bot.telegram.sendMessage(cid,
        `📦 #${id}\n${o.items.map(i=>i.name).join(', ')}\n💰 ${o.total}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("✅ Qabul qildim", `c_take_${id}`)],
            [Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]
        ])
    );

    bot.telegram.sendLocation(cid, o.latitude, o.longitude);

    ctx.editMessageText("Kuryerga yuborildi");
});

// ===== KURYER ACTION =====
bot.action(/c_take_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    const o = orders[id];

    if (!o) return;

    o.status = 'Yo‘lda 🚚';

    await bot.telegram.sendMessage(o.userId, "🚚 Yo‘lda");
    ctx.answerCbQuery("Qabul qilindi");
});

bot.action(/c_done_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const o = orders[id];

    if (!o) return;

    stats.totalSum += o.total;

    bot.telegram.sendMessage(o.userId, "🏁 Yetkazildi");
    bot.telegram.sendMessage(ADMIN_ID, `✅ #${id} yakunlandi`);

    delete orders[id];

    ctx.editMessageText("Topshirildi");
});

// ===== BOT START =====
bot.launch();
