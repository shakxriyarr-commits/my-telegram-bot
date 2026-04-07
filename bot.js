require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ===== CONFIG =====
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 8448862547;
const ADMIN_USERNAME = "@shakhriyar";

const KARTA = {
    number: "8600 0000 0000 0000",
    owner: "Falonchi Pistonchiyev"
};

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Ali" }
];

// ===== SERVER =====
const app = express();
app.get('/', (_, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

// ===== DB =====
const db = {
    users: {},
    carts: {},
    orders: {},
    stats: { total: 0, items: {} },
    courierStats: {},
    adminState: {},
    menu: [
        { id: 'b1', name: '🍔 Burger', price: 30000 },
        { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
        { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
        { id: 'l1', name: '🌯 Lavash', price: 32000 }
    ]
};

let orderId = 1;

// ===== HELPERS =====
const isAdmin = (id) => id === ADMIN_ID;
const isCourier = (id) => COURIERS.some(c => c.id === id);
const getCart = (id) => db.carts[id] || [];
const total = (items) => items.reduce((s, i) => s + i.price, 0);

// ===== KEYBOARDS =====
const KB = {
    main: Markup.keyboard([
        ['🍴 Menyu', '🛒 Savatcha'],
        ['🗂 Buyurtmalarim', '📞 Aloqa']
    ]).resize(),

    admin: Markup.keyboard([
        ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
        ['📊 Kunlik hisobot', '📦 Faol buyurtmalar'],
        ['🗑 Taomni o\'chirish', '🏠 Mijoz menyusiga o\'tish']
    ]).resize(),

    courier: Markup.keyboard([
        ['🏁 Topshirilgan buyurtmalarim'],
        ['🏠 Mijoz menyusiga o\'tish']
    ]).resize()
};

// ===== START =====
bot.start(ctx => {
    const id = ctx.from.id;
    if (isAdmin(id)) return ctx.reply("Admin panel 🛠", KB.admin);
    if (isCourier(id)) return ctx.reply("Kuryer panel 🚗", KB.courier);
    ctx.reply("Xush kelibsiz 👋", KB.main);
});

// ===== MENU =====
bot.hears('🍴 Menyu', ctx => {
    const btns = db.menu.map(i =>
        Markup.button.callback(`${i.name}\n${i.price}`, `add_${i.id}`)
    );
    ctx.reply("Tanlang:", Markup.inlineKeyboard(btns, { columns: 2 }));
});

bot.action(/add_(.+)/, ctx => {
    const item = db.menu.find(i => i.id === ctx.match[1]);
    if (!item) return;

    if (!db.carts[ctx.from.id]) db.carts[ctx.from.id] = [];
    db.carts[ctx.from.id].push(item);

    ctx.answerCbQuery("Qo'shildi ✅");
});

// ===== CART =====
bot.hears('🛒 Savatcha', ctx => {
    const cart = getCart(ctx.from.id);
    if (!cart.length) return ctx.reply("Savatcha bo'sh");

    let text = "🛒 Savatcha:\n\n";
    cart.forEach((i, n) => text += `${n+1}. ${i.name}\n`);

    ctx.reply(
        `${text}\n💰 ${total(cart)}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("✅ Buyurtma berish", "order")],
            [Markup.button.callback("🗑 Tozalash", "clear")]
        ])
    );
});

bot.action('clear', ctx => {
    db.carts[ctx.from.id] = [];
    ctx.editMessageText("Tozalandi");
});

// ===== ORDER FLOW =====
bot.action('order', ctx => {
    ctx.reply("📞 Raqam:", 
        Markup.keyboard([[Markup.button.contactRequest("📞")]]).resize().oneTime()
    );
});

bot.on('contact', ctx => {
    db.users[ctx.from.id] = {
        ...(db.users[ctx.from.id] || {}),
        phone: ctx.message.contact.phone_number
    };

    ctx.reply("📍 Lokatsiya:",
        Markup.keyboard([[Markup.button.locationRequest("📍")]]).resize().oneTime()
    );
});

bot.on('location', ctx => {
    const u = db.users[ctx.from.id];
    if (!u) return;

    u.loc = {
        lat: ctx.message.location.latitude,
        lon: ctx.message.location.longitude
    };

    ctx.reply("💳 To'lov:",
        Markup.inlineKeyboard([
            [Markup.button.callback("💵 Naqd (Kuryerga)", "cash")],
            [Markup.button.callback("💳 Karta orqali", "card")]
        ])
    );
});

// ===== PAYMENT =====
bot.action('cash', async ctx => {
    const cart = getCart(ctx.from.id);
    if (!cart.length) return;

    const o = {
        id: orderId++,
        userId: ctx.from.id,
        items: cart,
        total: total(cart),
        phone: db.users[ctx.from.id]?.phone,
        loc: db.users[ctx.from.id]?.loc,
        status: "Yangi"
    };

    db.orders[o.id] = o;
    db.carts[ctx.from.id] = [];

    await ctx.editMessageText(`✅ #${o.id} qabul qilindi`);
    sendToAdmin(o);
});

bot.action('card', ctx => {
    const sum = total(getCart(ctx.from.id));
    ctx.reply(
`💳 Karta:
${KARTA.number}
${KARTA.owner}

💰 ${sum}`
    );
});

// ===== ADMIN ORDER =====
async function sendToAdmin(o) {
    const text = o.items.map((i,n)=>`${n+1}. ${i.name}`).join('\n');

    await bot.telegram.sendMessage(ADMIN_ID,
`🆕 #${o.id}

${text}

💰 ${o.total}`,
Markup.inlineKeyboard([
    COURIERS.map(c => Markup.button.callback(c.name, `ch_${o.id}_${c.id}`)),
    [Markup.button.callback("❌ Rad etish", `rej_${o.id}`)]
])
);
}

// ===== COURIER =====
bot.action(/ch_(.+)_(.+)/, ctx => {
    const [_, id, cid] = ctx.match;
    const o = db.orders[id];
    if (!o) return;

    bot.telegram.sendMessage(cid, `📦 #${id}`);
    ctx.editMessageText("Yuborildi");
});

// ===== EXTRA =====
bot.hears('🗂 Buyurtmalarim', ctx => {
    const list = Object.values(db.orders).filter(o => o.userId === ctx.from.id);
    if (!list.length) return ctx.reply("Yo'q");

    list.forEach(o => ctx.reply(`#${o.id} - ${o.status}`));
});

bot.hears('📊 Kunlik hisobot', ctx => {
    if (!isAdmin(ctx.from.id)) return;
    ctx.reply(`💰 ${db.stats.total}`);
});

// ===== ERROR =====
bot.catch(console.error);

// ===== START =====
bot.launch();
console.log("🔥 IDEAL FULL BOT ISHLADI");
