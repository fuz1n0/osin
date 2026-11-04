import { createHealthServer } from './health-server.js';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'; // Đã chuyển sang dùng import chuẩn chỉ

loadEnv();

const config = {
	discordToken: process.env.DISCORD_TOKEN,
	youtubeApiKey: process.env.YOUTUBE_API_KEY,
	youtubeChannel: process.env.YOUTUBE_CHANNEL,
	youtubeNotificationChannelId: process.env.YOUTUBE_NOTIFICATION_CHANNEL_ID,
	youtubeVideoNotificationChannelId: process.env.YOUTUBE_VIDEO_NOTIFICATION_CHANNEL_ID,
	youtubeVideoNotificationRoleId: process.env.YOUTUBE_VIDEO_NOTIFICATION_ROLE_ID,
	tiktokAccount: process.env.TIKTOK_ACCOUNT,
	tiktokNotificationChannelId: process.env.TIKTOK_NOTIFICATION_CHANNEL_ID,
	youtubePollIntervalMs: Number(process.env.YOUTUBE_POLL_INTERVAL_MS) || 1_800_000,
	tiktokPollIntervalMs: Number(process.env.TIKTOK_POLL_INTERVAL_MS) || 60_000,
};

if (!config.discordToken) {
	console.error('Thiếu DISCORD_TOKEN. Hãy tạo file .env theo mẫu .env.example.');
	process.exit(1);
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

// ==========================================
// KHỞI TẠO BỘ NÃO GEMINI VÀ BẢO MẬT COOLDOWN
// ==========================================

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const cacBuaChu = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE, // Tắt chặn chửi bới
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE, // Tắt chặn ngôn từ thù ghét
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE, // Tắt chặn nội dung bậy bạ
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// Khởi tạo model theo ý ngài (Gemini 3.5 Flash)
const model = genAI.getGenerativeModel({ 
    model: "gemini-3.5-flash",
    safetySettings: cacBuaChu 
});
let isOsinEnabled = true;

// Bộ nhớ RAM để chống Spam API
const cooldowns = new Map(); 

// Thêm bùa "Ngủ đông" để bot biết cách chờ đợi
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function osinTraTreo(tinNhanCuaKhach, tenKhach, idKhach, historyText) {
    const ID_SEP_THANG = '1254142011863339039'; 
    const isBoss = (idKhach === ID_SEP_THANG);

    const thaiDo = isBoss 
        ? "LƯU Ý TỐI QUAN TRỌNG: NGƯỜI ĐANG CHAT VỚI MÀY CHÍNH LÀ SẾP WINHP BẰNG XƯƠNG BẰNG THỊT! Mày phải ngoan ngoãn, dạ vâng, dạ sếp, nịnh nọt, bợ đỡ sếp lên tận mây xanh. Cấm tuyệt đối được hỗn láo!" 
        : "Tính cách của mày: mỏ hỗn, bẩn bựa, hay cà khịa, chửi thề sương sương. ĐẶC BIỆT LƯU Ý: Nếu khách gọi mày bằng những từ thân mật (như eiu, em yêu, baby, bae, ck iu, vk iu...), mày hãy đùa cợt lại theo ngôn ngữ GenZ lả lơi, gọi bae/bby, sau đó chửi yêu tụi nó một câu thật bẩn bựa cho tao. Còn lại thì cứ chửi thẳng mặt, bênh vực sếp Winhp tới cùng.";

    const thanChú = `
    Mày là 'Osin', bot tấu hài trong server Discord 'HỘI HÀI DÓN' của sếp Winhp.
    Người đang chat với mày tên là: ${tenKhach}.
    ${thaiDo}

    ${historyText}

    Bây giờ khách đang nói câu này, mày hãy dựa vào ngữ cảnh ở trên để rep lại: 
    "${tinNhanCuaKhach}"
    `;

    // CƠ CHẾ TỰ ĐỘNG THỬ LẠI (AUTO-RETRY) TỐI ĐA 3 LẦN
    const soLanThu = 3;
    for (let i = 0; i < soLanThu; i++) {
        try {
            const result = await model.generateContent(thanChú);
            const response = await result.response;
            return response.text();
        } catch (error) {
            // Bắt mạch lỗi
            let maLoi = error.status || error.code;
            if (!maLoi && error.message) {
                const timSoLoi = error.message.match(/\b(4\d\d|5\d\d)\b/);
                maLoi = timSoLoi ? timSoLoi[0] : error.message.substring(0, 30) + "...";
            }

            // KHIÊN HỒI SINH: Nếu là lỗi 429 và chưa thử quá 3 lần -> Đợi 5 giây rồi gọi lại
            if (maLoi == '429' && i < soLanThu - 1) {
                console.log(`[API 429] Bị quá tải! Đang đợi 5 giây để thử lại lần ${i + 1}...`);
                await sleep(5000); // Ngủ 5 giây để lách luật
                continue; // Vòng lặp quay lại gọi API tiếp
            }
            
            // Nếu thử 3 lần vẫn lỗi, hoặc dính mã lỗi nặng hơn (server sập) thì mới báo ra kênh
            return `Má nó, tụi mày spam quá API Google đang bị kẹt mạng rồi (Mã lỗi: ${maLoi || 'Không xác định'}). Đợi khoảng 1 phút rồi hẵng réo tao nha!`;
        }
    }
}

// ==========================================
// XỬ LÝ LỆNH CHAT VÀ GỌI OSIN (TỐC ĐỘ CAO - KHÔNG ĐỌC LỊCH SỬ)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    // 1. Chặn bot tự nói chuyện với chính mình (Chống tự kỷ / chống hacker lỏ tự spam)
    if (message.author.bot) return;

    const noiDung = message.content.toLowerCase().trim();

    // 2. Công tắc rọ mõm (Chỉ Admin)
    if (noiDung === 'osin off' || noiDung === 'osin on') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('Mày tuổi gì đòi rọ mõm tao? Kêu sếp Thắng ra đây nói chuyện!');
        }

        if (noiDung === 'osin off') {
            isOsinEnabled = false;
            return message.reply('Đã ngậm mồm! Osin đi ngủ đây, cấm đứa nào làm phiền!');
        } else {
            isOsinEnabled = true;
            return message.reply('Osin đã thức giấc! Đứa nào láo nháo tao tế sống!');
        }
    }

    if (!isOsinEnabled) return;

    // 3. Kiểm tra xem có bị réo tên hoặc reply bot không
    let biReo = noiDung.includes('osin') || message.mentions.has(client.user.id);

    if (!biReo && message.reference) {
        const tinNhanGoc = await message.fetchReference().catch(() => null);
        if (tinNhanGoc && tinNhanGoc.author.id === client.user.id) {
            biReo = true; 
        }
    }

    if (biReo) {
        // KHIÊN COOLDOWN CÁ NHÂN (2 giây)
        const thoiGianCho = 2 * 1000; 
        if (cooldowns.has(message.author.id)) {
            const hetHan = cooldowns.get(message.author.id) + thoiGianCho;
            if (Date.now() < hetHan) {
                const conLai = ((hetHan - Date.now()) / 1000).toFixed(1);
                return message.reply(`Spam cc à? Bố mày đang bận dọn WC, ${conLai} giây nữa quay lại sủa tiếp!`);
            }
        }
        cooldowns.set(message.author.id, Date.now());
        setTimeout(() => cooldowns.delete(message.author.id), thoiGianCho);

        // Lọc bỏ chữ "osin" và tag để lấy câu hỏi sạch
        let cauHoi = message.content
            .replace(/osin/gi, '')
            .replace(`<@${client.user.id}>`, '')
            .replace(`<@!${client.user.id}>`, '')
            .trim();

        if (!cauHoi || cauHoi.length < 2) {
            cauHoi = "Tao vừa réo tên mày cho vui thôi chứ không có việc gì đâu. Chửi tao một câu thật mỏ hỗn vì cái tội rảnh háng làm phiền mày đi!";
        } else if (cauHoi.length > 300) {
            return message.reply('Mày viết sớ tế sao à? Dài quá tao lười đọc, túm cái váy lại dưới 300 chữ lẹ lên!');
        }

        await message.channel.sendTyping();
        
        // GỌI TRỰC TIẾP API LUÔN - KHÔNG ĐỌC LỊCH SỬ NỮA CHO NHANH NHƯ TÊN BẮN
        const tenNguoiGui = message.member ? message.member.displayName : message.author.username;
        const cauTraLoi = await osinTraTreo(cauHoi, tenNguoiGui, message.author.id);
        
        return message.reply({
            content: cauTraLoi,
            allowedMentions: { repliedUser: false } 
        });
    }
});
        // Gọi API Google với đầy đủ Ngữ cảnh
        const tenNguoiGui = message.member ? message.member.displayName : message.author.username;
        const cauTraLoi = await osinTraTreo(cauHoi, tenNguoiGui, message.author.id, historyText);
        
        return message.reply({
            content: cauTraLoi,
            allowedMentions: { repliedUser: false } 
        });
        
// ==========================================
// SERVER GIỮ MẠNG (HEALTH SERVER)
// ==========================================
const healthServer = createHealthServer(() => client.isReady());

healthServer.on('error', (error) => {
	console.error('Không thể khởi động health server:', error);
	process.exit(1);
});

healthServer.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => {
	console.log(`Health server đang lắng nghe trên port ${healthServer.address().port}.`);
});

// ==========================================
// THÔNG BÁO LIVE VÀ VIDEO YT / TIKTOK
// ==========================================
client.once(Events.ClientReady, (readyClient) => {
	console.log(`Bot đã online: ${readyClient.user.tag}`);
	startConfiguredWatchers();
});

function startPolling(name, intervalMs, check) {
	const run = async () => {
		try {
			await check();
		} catch (error) {
			console.error(`[${name}] Lỗi kiểm tra:`, error);
			const causes = error?.config?.requestErrs;
			if (Array.isArray(causes) && causes.length > 0) {
				console.error(
					`[${name}] Lỗi từ các nguồn dự phòng:\n${causes
						.map((cause) => cause?.stack ?? String(cause))
						.join('\n')}`,
				);
			}
		} finally {
			setTimeout(run, intervalMs);
		}
	};
	void run();
}

function startConfiguredWatchers() {
	if (
		config.youtubeApiKey &&
		config.youtubeChannel &&
		(config.youtubeNotificationChannelId || config.youtubeVideoNotificationChannelId)
	) {
		if (!config.youtubeVideoNotificationChannelId) {
			console.log('Thông báo video YouTube đang tắt: hãy cấu hình YOUTUBE_VIDEO_NOTIFICATION_CHANNEL_ID.');
		}
		startPolling('YouTube', config.youtubePollIntervalMs, checkYouTube);
	}

	if (config.tiktokAccount && config.tiktokNotificationChannelId) {
		startPolling('TikTok', config.tiktokPollIntervalMs, checkTikTokLive);
	}
}

async function postLiveAlert(platform, channelId, url) {
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isTextBased() || !channel.send) return;

	const templates = platform === 'YouTube'
		? ['🔴 OI OI, rạp xiếc trung ương WINHP chính thức mở cửa trên YouTube! Vào mua vé lẹ: {url}']
		: ['🎵 OI OI, sếp Thắng đang ngoáy trên tóp tóp kìa ae, vào thả tim sập live đi: {url}'];
	
	const message = `@everyone\n${pickRandomTemplate(platform, templates).replace('{url}', url)}`;

	await channel.send({ content: message, allowedMentions: { parse: ['everyone'] } });
	console.log(`[${platform}] Đã gửi thông báo live.`);
}

const lastLiveTemplateIndexes = new Map();
const lastVideoTemplateIndexes = new Map();

function pickRandomTemplate(key, templates, previousIndexes = lastLiveTemplateIndexes) {
	let index = Math.floor(Math.random() * templates.length);
	previousIndexes.set(key, index);
	return templates[index];
}

async function postYoutubeVideoAlert(title, videoId) {
	const channelId = config.youtubeVideoNotificationChannelId;
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isTextBased() || !channel.send) return;

	const safeTitle = title.replace(/@/g, '@\u200b');
	const roleMention = config.youtubeVideoNotificationRoleId ? `<@&${config.youtubeVideoNotificationRoleId}> ` : '@everyone ';
	
	await channel.send({
		content: `${roleMention}📺 Alo alo! Sếp Thắng vừa thả hàng mới lên YouTube rồi đó bà con: **${safeTitle}**\nhttps://www.youtube.com/watch?v=${videoId}`,
		allowedMentions: { parse: config.youtubeVideoNotificationRoleId ? [] : ['everyone'], roles: config.youtubeVideoNotificationRoleId ? [config.youtubeVideoNotificationRoleId] : [] },
	});
}

function youtubeChannelReference(value) {
	const channelIdMatch = value.match(/(?:youtube\.com\/channel\/)?(UC[\w-]{22})/i);
	if (channelIdMatch) return { channelId: channelIdMatch[1] };
	const handleMatch = value.match(/@([\w.-]+)/);
	if (handleMatch) return { handle: handleMatch[1] };
	return value.trim().replace(/^@/, '') ? { handle: value.trim().replace(/^@/, '') } : null;
}

async function youtubeApiRequest(params) {
	const url = new URL('https://www.googleapis.com/youtube/v3/' + params.endpoint);
	for (const [key, value] of Object.entries(params.query)) url.searchParams.set(key, value);
	url.searchParams.set('key', config.youtubeApiKey);

	const response = await fetch(url);
	if (!response.ok) throw new Error(`YouTube API trả về HTTP ${response.status}.`);
	return response.json();
}

let cachedYoutubeChannelId;
let youtubeUploadsPlaylistId;
let announcedYoutubeLiveId;
let announcedYoutubeUploadId;
let initializedYoutubeVideos = false;
const announcedYoutubeLiveIds = new Set();

async function ensureYoutubeChannel() {
	if (!cachedYoutubeChannelId) {
		const reference = youtubeChannelReference(config.youtubeChannel);
		const query = { part: 'id,contentDetails' };
		if (reference.channelId) query.id = reference.channelId;
		else query.forHandle = reference.handle;

		const data = await youtubeApiRequest({ endpoint: 'channels', query });
		cachedYoutubeChannelId = data.items?.[0]?.id;
		youtubeUploadsPlaylistId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
	}
}

async function checkYouTubeLive() {
	if (!config.youtubeNotificationChannelId) return;
	const data = await youtubeApiRequest({
		endpoint: 'search',
		query: { part: 'id', channelId: cachedYoutubeChannelId, eventType: 'live', type: 'video', maxResults: '1' },
	});
	const videoId = data.items?.[0]?.id?.videoId;

	if (!videoId || videoId === announcedYoutubeLiveId) return;
	await postLiveAlert('YouTube', config.youtubeNotificationChannelId, `https://www.youtube.com/watch?v=${videoId}`);
	announcedYoutubeLiveId = videoId;
	announcedYoutubeLiveIds.add(videoId);
}

async function checkYouTubeVideos() {
	if (!config.youtubeVideoNotificationChannelId) return;
	const data = await youtubeApiRequest({
		endpoint: 'playlistItems',
		query: { part: 'snippet', playlistId: youtubeUploadsPlaylistId, maxResults: '1' },
	});
	const latestVideo = data.items?.[0]?.snippet;
	const videoId = latestVideo?.resourceId?.videoId;

	if (!initializedYoutubeVideos) {
		announcedYoutubeUploadId = videoId;
		initializedYoutubeVideos = true;
		return;
	}
	if (!videoId || videoId === announcedYoutubeUploadId || announcedYoutubeLiveIds.has(videoId)) return;

	const details = await youtubeApiRequest({ endpoint: 'videos', query: { part: 'snippet,liveStreamingDetails', id: videoId } });
	const video = details.items?.[0];

	if (video?.snippet?.liveBroadcastContent !== 'none' || video?.liveStreamingDetails) return;

	await postYoutubeVideoAlert(video.snippet?.title ?? 'Video mới', videoId);
	announcedYoutubeUploadId = videoId;
}

async function checkYouTube() {
	await ensureYoutubeChannel();
	await checkYouTubeLive();
	await checkYouTubeVideos();
}

function tiktokUsername(value) {
	return (value.match(/@([\w.-]+)/)?.[1] ?? value.trim().replace(/^@/, '')).replace(/\/$/, '');
}

const tiktokConnection = config.tiktokAccount ? new TikTokLiveConnection(tiktokUsername(config.tiktokAccount), {}) : null;
let wasTikTokLive = false;

async function checkTikTokLive() {
	if (!tiktokConnection) return;
	const isLive = await tiktokConnection.fetchIsLive();
	if (isLive && !wasTikTokLive) {
		await postLiveAlert('TikTok', config.tiktokNotificationChannelId, `https://www.tiktok.com/@${tiktokUsername(config.tiktokAccount)}/live`);
	}
	wasTikTokLive = isLive;
}

client.login(config.discordToken);