const { Telegraf, Markup } = require('telegraf');

// 1. Bot sozlamalari
const token = process.env.BOT_TOKEN;
const ADMIN_ID = '7312694067'; // O'zingizning ID raqamingizni yozing

const bot = new Telegraf(BOT_TOKEN);

// Ma'lumotlarni saqlash (Vaqtinchalik)
const activeOrders = {};   // Jarayondagi (telefon/manzil kutilayotgan) buyurtmalar
const finishedOrders = {}; // Yakunlangan (adminga ketgan) buyurtmalar

// 2. Asosiy menyu
const mainKeyboard = Markup.keyboard([
    ['🍔 Burger - 30,000', ' 🍔 Burger dvaynoy - 35,000'],
    ['🍔 Burger troynoy - 40,000', '🌯lavash - 32,000'],
    ['📋 Buyurtmalarim', '📞 Bizning raqam']
]).resize();

// START komandasi
bot.start((ctx) => {
    ctx.reply('Xush kelibsiz! Taom tanlang yoki buyurtmalaringizni boshqaring:', mainKeyboard);
});

// 3. Matnli xabarlarni qayta ishlash
bot.on('text', async (ctx) => {
    const msg = ctx.message.text;
    const userId = ctx.from.id;

    // Taom tanlanganda
    if (msg.includes('Burger') || msg.includes('Lavash')) {
        activeOrders[userId] = { food: msg, step: 'get_phone' };
        return ctx.reply(`✅ ${msg} tanlandi.\nTelefon raqamingizni pastdagi tugma orqali yuboring:`, 
            Markup.keyboard([[Markup.button.contactRequest('📱 Raqamni yuborish')]]).resize().oneTime()
        );
    }

    // Buyurtmalarim bo'limi
    if (msg === '📋 Buyurtmalarim') {
        const order = finishedOrders[userId];
        if (!order) {
            return ctx.reply("Sizda hozircha faol buyurtma yo'q.");
        }
        return ctx.reply(
            `Sizning oxirgi buyurtmangiz:\n\n📦 Taom: ${order.food}\n📞 Tel: ${order.phone}\n\nBuyurtmani bekor qilmoqchimisiz?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Bekor qilish', 'cancel_order')]
            ])
        );
    }

    if (msg === '📞 Bizning raqam') {
        return ctx.reply('☎️ Bizning raqamimiz: +998-99-450-67-67');
    }
});

// 4. Kontakt (Telefon) qabul qilish
bot.on('contact', (ctx) => {
    const userId = ctx.from.id;
    if (activeOrders[userId] && activeOrders[userId].step === 'get_phone') {
        activeOrders[userId].phone = ctx.message.contact.phone_number;
        activeOrders[userId].step = 'get_location';

        return ctx.reply('Rahmat! Endi yetkazib berish manzilini (lokatsiya) yuboring:', 
            Markup.keyboard([[Markup.button.locationRequest('📍 Manzilni yuborish')]]).resize().oneTime()
        );
    }
});

// 5. Lokatsiya qabul qilish va Adminga jo'natish
bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const loc = ctx.message.location;

    if (activeOrders[userId] && activeOrders[userId].step === 'get_location') {
        const orderData = activeOrders[userId];
        
        // Google Maps havolasi (To'g'ri formatda)
        const mapLink = `https://www.google.com{loc.latitude},${loc.longitude}`;

        // Buyurtmani yakunlanganlarga qo'shish
        finishedOrders[userId] = { 
            food: orderData.food, 
            phone: orderData.phone,
            lat: loc.latitude,
            lon: loc.longitude 
        };

        const report = `🔔 <b>YANGI BUYURTMA!</b>\n\n` +
                       `📦 <b>Taom:</b> ${orderData.food}\n` +
                       `👤 <b>Mijoz:</b> ${ctx.from.first_name}\n` +
                       `📞 <b>Telefon:</b> +${orderData.phone}\n` +
                       `📍 <a href="${mapLink}">Xaritada ko'rish</a>`;

        try {
            // Adminga xabar va lokatsiya yuborish
            await bot.telegram.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
            await bot.telegram.sendLocation(ADMIN_ID, loc.latitude, loc.longitude);

            await ctx.reply('✅ Rahmat! Buyurtmangiz qabul qilindi. Tez orada bog\'lanamiz.', mainKeyboard);
            delete activeOrders[userId]; // Vaqtincha jarayonni tozalash
        } catch (err) {
            console.error("Xatolik:", err);
            ctx.reply("Xatolik yuz berdi, qaytadan urinib ko'ring.");
        }
    }
});

// 6. Buyurtmani bekor qilish (Inline tugma)
bot.action('cancel_order', async (ctx) => {
    const userId = ctx.from.id;
    if (finishedOrders[userId]) {
        delete finishedOrders[userId];
        
        // Adminga bildirishnoma
        await bot.telegram.sendMessage(ADMIN_ID, `⚠️ Mijoz ${ctx.from.first_name} buyurtmani bekor qildi.`);
        
        await ctx.answerCbQuery("Buyurtma bekor qilindi");
        return ctx.editMessageText("❌ Buyurtmangiz bekor qilindi.");
    }
    await ctx.answerCbQuery("Bekor qilinadigan buyurtma topilmadi.");
});

// Botni ishga tushirish
bot.launch().then(() => {
    console.log("🚀 Bot muvaffaqiyatli ishga tushdi!");
});

// Xatoliklarni ushlash
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
