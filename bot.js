const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 8448862547;
const PAYMENT_TOKEN = process.env.PAYMENT_TOKEN;

// DATA
let carts = {};
let users = {};
let orders = {};
let orderCounter = 1;

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" }
];

let menu = [
    { id: '1', name: '🍔 Burger', price: 30000 },
    { id: '2', name: '🌯 Lavash', price: 32000 }
];

// KEYBOARDS
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['📦 Buyurtmalar']
]).resize();

const courierKeyboard = Markup.keyboard([
    ['📦 Mening buyurtmalarim']
]).resize();

// START
bot.start((ctx) => {
    const id = ctx.from.id;

    if (id === ADMIN_ID) return ctx.reply("Admin panel", adminKeyboard);
    if (COURIERS.some(c => c.id === id)) return ctx.reply("Kuryer panel", courierKeyboard);

    ctx.reply("Xush kelibsiz 👋", mainKeyboard);
});

// MENU
bot.hears('🍴 Menyu', (ctx) => {
    const btns = menu.map(i =>
        Markup.button.callback(`${i.name} - ${i.price}`, `add_${i.id}`)
    );
    ctx.reply("Tanlang:", Markup.inlineKeyboard(btns, { columns: 1 }));
});

// ADD CART
bot.action(/add_(.+)/, (ctx) => {
    const item = menu.find(i => i.id === ctx.match[1]);

    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push(item);

    ctx.answerCbQuery("Qo'shildi ✅");
});

// CART
bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];

    if (cart.length === 0) return ctx.reply("Bo'sh");

    let total = 0;
    let text = "🛒 Savatcha:\n\n";

    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name}\n`;
        total += i.price;
    });

    ctx.reply(text + `\n💰 ${total}`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma", "checkout")]
    ]));
});

// CHECKOUT
bot.action('checkout', (ctx) => {
    ctx.reply("📞 Raqam yubor:", Markup.keyboard([
        [Markup.button.contactRequest("📞 Yuborish")]
    ]).resize().oneTime());
});

// CONTACT
bot.on('contact', (ctx) => {
    users[ctx.from.id] = {
        phone: ctx.message.contact.phone_number
    };

    ctx.reply("📍 Lokatsiya yubor:", Markup.keyboard([
        [Markup.button.locationRequest("📍 Yuborish")]
    ]).resize().oneTime());
});

// LOCATION
bot.on('location', (ctx) => {
    users[ctx.from.id].location = ctx.message.location;

    ctx.reply("To'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd", "cash")],
        [Markup.button.callback("💳 Karta", "card")]
    ]));
});

// CASH
bot.action('cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId];

    const total = cart.reduce((a, b) => a + b.price, 0);
    const orderId = orderCounter++;

    orders[orderId] = {
        userId,
        cart,
        total,
        status: "Naqd"
    };

    carts[userId] = [];

    await ctx.reply(`✅ Buyurtma #${orderId}`);

    sendToAdmin(orderId);
});

// CARD PAYMENT
bot.action('card', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId];

    if (!cart || cart.length === 0) return ctx.reply("Savatcha bo'sh");

    const total = cart.reduce((a, b) => a + b.price, 0);

    await ctx.replyWithInvoice(
        "Food",
        "To'lov",
        `order_${Date.now()}`,
        PAYMENT_TOKEN,
        "UZS",
        [{ label: "Jami", amount: total * 100 }]
    );
});

// PRE CHECKOUT
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

// SUCCESS PAYMENT
bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId];

    const total = cart.reduce((a, b) => a + b.price, 0);
    const orderId = orderCounter++;

    orders[orderId] = {
        userId,
        cart,
        total,
        status: "To'landi"
    };

    carts[userId] = [];

    await ctx.reply(`✅ To'lov bo'ldi #${orderId}`);

    sendToAdmin(orderId);
});

// SEND TO ADMIN
function sendToAdmin(orderId) {
    const order = orders[orderId];

    let text = `🆕 Buyurtma #${orderId}\n\n`;

    order.cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name}\n`;
    });

    text += `\n💰 ${order.total}`;

    bot.telegram.sendMessage(ADMIN_ID, text, Markup.inlineKeyboard([
        [Markup.button.callback("🚚 Kuryerga berish", `assign_${orderId}`)]
    ]));
}

// ASSIGN COURIER
bot.action(/assign_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const courier = COURIERS[0];

    bot.telegram.sendMessage(courier.id, `📦 Buyurtma #${orderId}`);
    ctx.editMessageText("Kuryerga yuborildi ✅");
});

// LAUNCH
bot.launch();
