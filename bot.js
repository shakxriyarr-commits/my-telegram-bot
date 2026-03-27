const { Telegraf, Markup, session } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 

bot.use(session()); // Admin bosqichlarini eslab qolish uchun

const app = express();
app.get('/', (req, res) => res.send('System Online 🚀'));
app.listen(process.env.PORT || 3000);

// MA'LUMOTLAR
let orderCounter = 1; 
let stats = { totalSum: 0, items: {} };
let menu = [
    { id: 'm1', name: '🍔 Burger', price: 30000 },
    { id: 'm2', name: '🌯 Lavash', price: 32000 }
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

const cancelKeyboard = Markup.keyboard([['❌ Bekor qilish']]).resize();

// --- START ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) {
        ctx.reply("Assalomu alaykum, Boss! Ishni boshlaymizmi? 🛠", adminKeyboard);
    } else {
        ctx.reply("Coffee Food botiga xush kelibsiz! 👋\nMazali taomlar sizni kutmoqda.", mainKeyboard);
    }
});

// --- MIJOZ: DINAMIK MENYU ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = [];
    for (let i = 0; i < menu.length; i += 2) {
        const row = [menu[i].name];
        if (menu[i + 1]) row.push(menu[i + 1].name);
        buttons.push(row);
    }
    buttons.push(['🛒 Savatcha', '🏠 Asosiy menyu']);
    ctx.reply("Marhamat, taom tanlang:", Markup.keyboard(buttons).resize());
});

// --- ADMIN: TAOM QO'SHISH (PRO SCENE) ---
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.session = { step: 'ADD_NAME' };
    ctx.reply("Yangi taom nomini kiriting:", cancelKeyboard);
});

// --- ADMIN: NARXNI O'ZGARTIRISH ---
bot.hears('✏️ Narxni o\'zgartirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(item => [Markup.button.callback(`✏️ ${item.name}`, `edit_price_${item.id}`)]);
    ctx.reply("Narxi o'zgaradigan taomni tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/edit_price_(.+)/, (ctx) => {
    const itemId = ctx.match[1];
    ctx.session = { step: 'EDIT_PRICE', itemId: itemId };
    ctx.answerCbQuery("Taom tanlandi ✅"); // Tugma bosilgandagi reaksiya
    ctx.reply("Yangi narxni kiriting (faqat raqam):", cancelKeyboard);
});

// --- MATNLI XABARLARNI FILTRLASH ---
bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (text === '❌ Bekor qilish') {
        ctx.session = null;
        const kb = userId === ADMIN_ID ? adminKeyboard : mainKeyboard;
        return ctx.reply("Amal bekor qilindi.", kb);
    }

    // Admin jarayonlari
    if (userId === ADMIN_ID && ctx.session) {
        if (ctx.session.step === 'ADD_NAME') {
            ctx.session.name = text;
            ctx.session.step = 'ADD_PRICE';
            return ctx.reply(`"${text}" uchun narxni kiriting:`);
        }
        if (ctx.session.step === 'ADD_PRICE') {
            const price = parseInt(text);
            if (isNaN(price)) return ctx.reply("Iltimos, narxni raqamda kiriting!");
            menu.push({ id: 'm' + Date.now(), name: ctx.session.name, price: price });
            ctx.session = null;
            return ctx.reply("✅ Yangi taom menyuga muvaffaqiyatli qo'shildi!", adminKeyboard);
        }
        if (ctx.session.step === 'EDIT_PRICE') {
            const price = parseInt(text);
            if (isNaN(price)) return ctx.reply("Faqat raqam kiriting!");
            const item = menu.find(i => i.id === ctx.session.itemId);
            if (item) {
                item.price = price;
                ctx.session = null;
                return ctx.reply(`✅ ${item.name} narxi yangilandi!`, adminKeyboard);
            }
        }
    }

    // Mijoz savatga qo'shishi
    const menuItem = menu.find(i => i.name === text);
    if (menuItem) {
        if (!carts[userId]) carts[userId] = [];
        carts[userId].push({ ...menuItem });
        return ctx.reply(`✅ ${menuItem.name} savatga qo'shildi!`);
    }

    if (text === '🏠 Asosiy menyu' || text === '🏠 Mijoz menyusiga o\'tish') {
        return ctx.reply("Asosiy menyuga qaytdingiz.", mainKeyboard);
    }

    await next();
});

// --- SAVATCHA ---
bot.hears('🛒 Savatcha', (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo'sh 🛒", mainKeyboard);

    let total = 0;
    let text = "🛒 *Sizning savatchangiz:*\n\n";
    const counts = {};
    cart.forEach(i => { counts[i.name] = (counts[i.name] || 0) + 1; total += i.price; });
    
    for (const [name, qty] of Object.entries(counts)) { text += `🔸 ${name} x ${qty}\n`; }
    text += `\n💰 *Jami:* ${total.toLocaleString()} so'm`;

    ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtmani rasmiylashtirish", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

// --- BUYURTMA BOSHQARUVI ---
bot.action('order_start', (ctx) => {
    ctx.answerCbQuery("Buyurtma boshlandi 📝");
    ctx.reply("📞 Telefon raqamingizni yuboring:", 
        Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.action('clear_cart', (ctx) => {
    carts[ctx.from.id] = [];
    ctx.answerCbQuery("Savatcha tozalandi 🗑");
    ctx.editMessageText("Savatchangiz bo'shatildi.");
});

// --- KONTAKT VA LOKATSIYA ---
bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Endi manzilingizni yuboring:", 
        Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiya yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length || !users[userId]) return;

    const orderId = orderCounter++;
    const total = cart.reduce((a, b) => a + b.price, 0);
    const orderItems = cart.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');

    await ctx.reply(`✅ Rahmat! Buyurtmangiz qabul qilindi (#${orderId}).`, mainKeyboard);
    
    // Adminga hisobot
    await bot.telegram.sendMessage(ADMIN_ID, 
        `🆕 *YANGI BUYURTMA #${orderId}*\n📞 Tel: ${users[userId].phone}\n📋 Tarkibi:\n${orderItems}\n💰 Jami: ${total.toLocaleString()} so'm`, 
        { parse_mode: 'Markdown' });
    await bot.telegram.sendLocation(ADMIN_ID, ctx.message.location.latitude, ctx.message.location.longitude);
    
    carts[userId] = [];
});

bot.launch();
