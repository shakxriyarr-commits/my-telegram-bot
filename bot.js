const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY KONFIGURATSIYA
const bot = new Telegraf(process.env.BOT_TOKEN); 
const ADMIN_ID = 8448862547; 

// Siz yuborgan Provider Token (BotFather'dan olingan)
const PAYMENT_TOKEN = '398062629:TEST:999999999_F91D8F69C042267444B74CC0B3C747757EB0E065'; 

const app = express();
app.get('/', (req, res) => res.send('Bot status: Active!'));
app.listen(process.env.PORT || 3000);

let orderCounter = 1; 
let stats = { totalSum: 0 }; 
let adminState = {}; 

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Ali" }
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

// 2. KLAVIATURALAR (TO'LIQ)
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
    ['📊 Kunlik hisobot', '📦 Faol buyurtmalar'],
    ['🗑 Taomni o\'chirish', '🏠 Mijoz menyusiga o\'tish']
]).resize();

const courierKeyboard = Markup.keyboard([
    ['🏁 Topshirilgan buyurtmalarim'],
    ['🏠 Mijoz menyusiga o\'tish']
]).resize();

// 3. ADMINGA BUYURTMA YUBORISH (TO'LIQ FUNKSIYA)
async function sendOrderToAdmin(orderId) {
    const order = orders[orderId];
    if (!order) return;
    
    let itemsText = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
    let paymentStatus = order.paymentType === 'cash' ? "💵 Naqd" : "💳 Karta orqali (To'langan ✅)";
    
    await bot.telegram.sendMessage(ADMIN_ID, `🆕 *YANGI BUYURTMA #${orderId}*\n\n📋 *Tarkibi:*\n${itemsText}\n\n📞 Tel: +${order.phone}\n💰 Jami: ${order.total.toLocaleString()} so'm\n💳 To'lov: ${paymentStatus}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback("🚚 Shahriyor", `assign_${orderId}_6382827314`),
                Markup.button.callback("🚚 Ali", `assign_${orderId}_222222222`)
            ],
            [Markup.button.callback("👨‍🍳 Tayyorlash (Bloklash)", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `reject_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${orderId}`)],
            [Markup.button.callback("⏳ Buyurtma ko'p (Ogohlantirish)", `busy_warn_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// 4. BOT START VA ROLLARI
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) {
        ctx.reply("Assalomu alaykum Admin paneliga xush kelibsiz!", adminKeyboard);
    } else if (COURIERS.some(c => c.id === userId)) {
        ctx.reply("Kuryer paneliga xush kelibsiz!", courierKeyboard);
    } else {
        ctx.reply("Coffee Food botiga xush kelibsiz! 👋\nMarhamat, taom tanlang:", mainKeyboard);
    }
});

// 5. ADMIN: MENYU BOSHQARUVI (QISQARTIRILMAGAN)
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'add_name' };
    ctx.reply("Yangi taom nomini kiriting:");
});

bot.hears('✏️ Narxni o\'zgartirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const btns = menu.map(i => [Markup.button.callback(i.name, `edit_price_${i.id}`)]);
    ctx.reply("Qaysi taom narxini o'zgartiramiz?", Markup.inlineKeyboard(btns));
});

bot.hears('🗑 Taomni o\'chirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const btns = menu.map(i => [Markup.button.callback(`🗑 ${i.name}`, `delete_item_${i.id}`)]);
    ctx.reply("O'chirish uchun taomni tanlang:", Markup.inlineKeyboard(btns));
});

bot.action(/edit_price_(.+)/, (ctx) => {
    adminState[ctx.from.id] = { step: 'edit_new_price', itemId: ctx.match[1] };
    ctx.reply("Yangi narxni yozing (faqat raqam):");
});

bot.action(/delete_item_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const index = menu.findIndex(i => i.id === id);
    if (index !== -1) {
        menu.splice(index, 1);
        ctx.editMessageText("✅ Taom menyudan muvaffaqiyatli o'chirildi.");
    }
});

bot.on('text', (ctx, next) => {
    const userId = ctx.from.id;
    const state = adminState[userId];
    if (!state || userId !== ADMIN_ID) return next();

    if (state.step === 'add_name') {
        state.name = ctx.message.text;
        state.step = 'add_price';
        ctx.reply(`${state.name} uchun narxni kiriting:`);
    } else if (state.step === 'add_price') {
        const pr = parseInt(ctx.message.text);
        if (isNaN(pr)) return ctx.reply("Faqat raqam yozing!");
        menu.push({ id: 'm' + Date.now(), name: state.name, price: pr });
        delete adminState[userId];
        ctx.reply("✅ Taom qo'shildi!", adminKeyboard);
    } else if (state.step === 'edit_new_price') {
        const pr = parseInt(ctx.message.text);
        if (isNaN(pr)) return ctx.reply("Faqat raqam yozing!");
        const item = menu.find(i => i.id === state.itemId);
        if (item) item.price = pr;
        delete adminState[userId];
        ctx.reply("✅ Narx yangilandi!", adminKeyboard);
    }
});

// 6. MIJOZ: MENYU VA SAVATCHA
bot.hears('🍴 Menyu', (ctx) => {
    const btns = menu.map(i => Markup.button.callback(`${i.name} - ${i.price.toLocaleString()} so'm`, `add_cart_${i.id}`));
    ctx.reply("Menyudan taomni tanlang:", Markup.inlineKeyboard(btns, { columns: 1 }));
});

bot.action(/add_cart_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    const item = menu.find(i => i.id === id);
    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push({ ...item });
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (cart.length === 0) return ctx.reply("Savatchangiz bo'sh 🛒");

    let total = 0;
    let msg = "🛒 *Savatchangiz:*\n\n";
    cart.forEach((item, index) => {
        msg += `${index + 1}. ${item.name} — ${item.price.toLocaleString()} so'm\n`;
        total += item.price;
    });

    ctx.replyWithMarkdown(`${msg}\n💰 *Jami:* ${total.toLocaleString()} so'm`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "checkout_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart_all")]
    ]));
});

bot.action('clear_cart_all', (ctx) => {
    carts[ctx.from.id] = [];
    ctx.editMessageText("Savatchangiz tozalandi 🗑");
});

// 7. BUYURTMA JARAYONI (MIJOZ)
bot.action('checkout_start', (ctx) => {
    ctx.reply("📞 Telefon raqamingizni yuboring:", 
        Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Yetkazish manzilini (lokatsiya) yuboring:", 
        Markup.keyboard([[Markup.button.locationRequest("📍 Manzilni yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId] || carts[userId].length === 0) return ctx.reply("Xatolik: Savatcha bo'sh.");
    users[userId].location = ctx.message.location;

    await ctx.reply("💳 To'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd (Kuryerga)", "order_cash")],
        [Markup.button.callback("💳 Click / Payme", "order_card")]
    ]));
});

// 8. TO'LOV VA BUYURTMANI YAKUNLASH
bot.action('order_cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId];
    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    orders[orderId] = {
        userId, phone: users[userId].phone,
        latitude: users[userId].location.latitude,
        longitude: users[userId].location.longitude,
        items: [...cart], total,
        status: 'Yangi', paymentType: 'cash'
    };

    await ctx.editMessageText(`✅ Buyurtma #${orderId} qabul qilindi. To'lov: Naqd.`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

bot.action('order_card', async (ctx) => {
    const userId = ctx.from.id;
    const total = carts[userId].reduce((a, b) => a + b.price, 0);
    try {
        await ctx.replyWithInvoice(
            "Coffee Food", "Taomlar uchun to'lov",
            `payload_${userId}_${Date.now()}`, PAYMENT_TOKEN, "UZB",
            [{ label: "Jami summa", amount: total * 100 }]
        );
        await ctx.answerCbQuery();
    } catch (e) {
        await ctx.reply("❌ To'lov tizimiga ulanishda xato. Iltimos qayta uruning.");
    }
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    const orderId = (orderCounter++).toString();
    const cart = carts[userId];

    orders[orderId] = {
        userId, phone: users[userId].phone,
        latitude: users[userId].location.latitude,
        longitude: users[userId].location.longitude,
        items: [...cart], total: cart.reduce((a, b) => a + b.price, 0),
        status: 'To\'landi ✅', paymentType: 'card'
    };

    await ctx.reply(`✅ To'lov muvaffaqiyatli! Buyurtma #${orderId} qabul qilindi.`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// 9. ADMIN VA KURYER BOSHQARUVI (TO'LIQ)
bot.action(/assign_(.+)_(.+)/, (ctx) => {
    const [_, oId, cId] = ctx.match;
    const order = orders[oId];
    const courier = COURIERS.find(c => c.id == cId);

    if (order && courier) {
        order.status = 'Kuryerda';
        let itemsMsg = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
        
        bot.telegram.sendMessage(cId, `📦 *YANGI BUYURTMA #${oId}*\n\n📋 *Tarkibi:*\n${itemsMsg}\n\n📞 Tel: +${order.phone}\n💰 Summa: ${order.total.toLocaleString()} so'm`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Qabul qildim", `courier_take_${oId}`)],
                [Markup.button.callback("🏁 Topshirdim", `courier_done_${oId}`)]
            ])
        });
        bot.telegram.sendLocation(cId, order.latitude, order.longitude);
        ctx.editMessageText(`✅ #${oId} buyurtma ${courier.name}ga biriktirildi.`);
    }
});

bot.action(/courier_take_(.+)/, async (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        orders[oId].status = 'Yo\'lda 🚚';
        await bot.telegram.sendMessage(orders[oId].userId, `🚀 Buyurtmangiz #${oId} yo'lda! Kuryer manzilingizga chiqdi.`);
        await ctx.answerCbQuery("Mijozga xabar yuborildi.");
    }
});

bot.action(/courier_done_(.+)/, (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        stats.totalSum += orders[oId].total;
        bot.telegram.sendMessage(orders[oId].userId, `🏁 Buyurtmangiz #${oId} yetkazildi! Yoqimli ishtaha! 👋`);
        bot.telegram.sendMessage(ADMIN_ID, `✅ Buyurtma #${oId} topshirildi.`);
        ctx.editMessageText(`🏁 Yakunlandi.`);
        delete orders[oId];
    }
});

bot.action(/lock_(.+)/, async (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        orders[oId].status = 'Tayyorlanmoqda';
        await bot.telegram.sendMessage(orders[oId].userId, `👨‍🍳 Buyurtmangiz #${oId} tayyorlanmoqda! Bekor qilish imkoniyati yopildi.`);
        await ctx.answerCbQuery("Bloklandi.");
    }
});

bot.action(/out_list_(.+)/, (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        const btns = orders[oId].items.map((it, idx) => [Markup.button.callback(`❌ ${it.name} tugagan`, `remove_item_${oId}_${idx}`)]);
        ctx.editMessageText("Qaysi mahsulot tugaganligini tanlang:", Markup.inlineKeyboard(btns));
    }
});

bot.action(/remove_item_(.+)_(.+)/, async (ctx) => {
    const [_, oId, idx] = ctx.match;
    const order = orders[oId];
    if (order) {
        const removed = order.items[idx];
        order.items.splice(idx, 1);
        order.total -= removed.price;
        await bot.telegram.sendMessage(order.userId, `⚠️ Uzr, buyurtmangizdagi *${removed.name}* tugagan ekan. Qolganlari yetkaziladi.`);
        ctx.editMessageText(`✅ ${removed.name} o'chirildi.`);
    }
});

bot.action(/busy_warn_(.+)/, async (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        await bot.telegram.sendMessage(orders[oId].userId, `⏳ Buyurtmalar ko'pligi sababli biroz kechikish bo'lishi mumkin. Uzr so'raymiz!`);
        await ctx.answerCbQuery("Mijoz ogohlantirildi.");
    }
});

bot.action(/reject_(.+)/, (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        bot.telegram.sendMessage(orders[oId].userId, `❌ Uzr, buyurtmangiz #${oId} bekor qilindi.`);
        delete orders[oId];
        ctx.editMessageText(`❌ #${oId} rad etildi.`);
    }
});

// 10. HISOBOT VA KO'RINISH
bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id === ADMIN_ID) ctx.reply(`📊 Bugungi umumiy savdo: ${stats.totalSum.toLocaleString()} so'm`);
});

bot.hears('📦 Faol buyurtmalar', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const active = Object.keys(orders);
    if (active.length === 0) return ctx.reply("Hozircha faol buyurtmalar yo'q.");
    active.forEach(id => {
        ctx.reply(`📦 #${id} - ${orders[id].status}\n💰 Summa: ${orders[id].total} so'm`);
    });
});

bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz menyusi:", mainKeyboard));

bot.launch();
