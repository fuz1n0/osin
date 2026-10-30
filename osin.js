import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { TikTokLiveConnection } from 'tiktok-live-connector';

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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
		} else if (
			config.youtubeNotificationChannelId === config.youtubeVideoNotificationChannelId
		) {
			console.warn('Kênh thông báo video và live YouTube đang dùng cùng ID.');
		}
		startPolling('YouTube', config.youtubePollIntervalMs, checkYouTube);
	} else {
		console.log('YouTube watcher chưa bật: cần API key, link/kênh và ít nhất một ID kênh thông báo.');
	}

	if (config.tiktokAccount && config.tiktokNotificationChannelId) {
		startPolling('TikTok', config.tiktokPollIntervalMs, checkTikTokLive);
	} else {
		console.log('TikTok watcher chưa bật: cần tài khoản và ID kênh thông báo.');
	}
}

async function postLiveAlert(platform, channelId, url) {
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isTextBased() || !channel.send) {
		throw new Error(`ID kênh Discord không hợp lệ hoặc bot không gửi được: ${channelId}`);
	}

	const templates = platform === 'YouTube'
		? [
			'🔴 OI OI, rạp xiếc trung ương WINHP chính thức mở cửa trên YouTube! Vào mua vé lẹ: {url}',
        '📣 Alo 500 anh em, sếp Thắng đang on the sờ trimmm! Vào cúng view lẹ cho tui nhờ: {url}',
        '🚨 Biến căng! WINHP đang múa phím trên YouTube, vào hóng lẹ kẻo ổng xóa live: {url}',
        '🎥 Tới giờ trốn việc rồi! Sang YouTube xem WINHP tấu hài xả stress thôi: {url}',
        '✨ Giờ này mà còn chưa vào xem sếp Thắng live thì tháng này nhịn cơm: {url}',
        '👀 Giáo án đi rừng mỏ hỗn bắt đầu trên YouTube! Lấy giấy bút ra chép lẹ: {url}',
        '🔥 Đỉnh cao tấu hài WINHP đã comeback, link nóng hổi vừa thổi vừa xem đây: {url}',
        '🛎️ Ting ting! Con Osin xin thông báo sếp Thắng đang live, anh em click lẹ đi cho tui chạy đủ KPI: {url}',
        '📢 Hế lô ae, WINHP đang phát trực tiếp nè, tạt qua chào sếp một tiếng cho sếp vui: {url}',
        '🤡 Ai đang rảnh rỗi sinh nông nổi thì bơi hết vào live YouTube của WINHP ngay và luôn: {url}'
    ]
    : [
        '🎵 OI OI, sếp Thắng đang ngoáy trên tóp tóp kìa ae, vào thả tim sập live đi: {url}',
        '📣 Lướt TikTok rác làm gì, vào xem rạp xiếc WINHP live cho đỡ chán đời nè: {url}',
        '🚨 Alo alo, WINHP đang combat bằng mõm bên TikTok, anh em vào tiếp viện ngay: {url}',
        '✨ Idol Tóp Tóp WINHP lên sóng rồi, vào cúng hoa hồng lẹ không ổng dỗi: {url}',
        '👀 Đang buồn chán? Vào ngay TikTok WINHP hít hà drama tấu hài nè: {url}',
        '🔥 TikTok đang nóng lên vì sếp Thắng vừa lên sóng, chần chừ gì nữa: {url}',
        '🛎️ Bỏ điện thoại xuống... à nhầm, cầm điện thoại lên vào xem WINHP live TikTok lẹ: {url}',
        '📢 Lớp học mỏ hỗn của WINHP trên TikTok chính thức bắt đầu, vắng mặt ghi sổ đầu bài: {url}',
        '🤡 Sếp Thắng đang on live TikTok. Anh em không vào là sếp trừ lương con Osin này đấy: {url}',
        '🚀 Đừng lướt vội, dừng chân lại trạm dừng nghỉ WINHP tấu hài tóp tóp ngay đây: {url}'
    ];
	
	const message = `@everyone\n${pickRandomTemplate(platform, templates).replace('{url}', url)}`;

	await channel.send({
		content: message,
		allowedMentions: { parse: ['everyone'] },
	});
	console.log(`[${platform}] Đã gửi thông báo live.`);
}

const lastLiveTemplateIndexes = new Map();
const lastVideoTemplateIndexes = new Map();

function pickRandomTemplate(key, templates, previousIndexes = lastLiveTemplateIndexes) {
	let index = Math.floor(Math.random() * templates.length);
	const previousIndex = previousIndexes.get(key);
	if (templates.length > 1 && index === previousIndex) {
		index = (index + 1 + Math.floor(Math.random() * (templates.length - 1))) % templates.length;
	}
	previousIndexes.set(key, index);
	return templates[index];
}

async function postYoutubeVideoAlert(title, videoId) {
	const channelId = config.youtubeVideoNotificationChannelId;
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isTextBased() || !channel.send) {
		throw new Error(
			`ID kênh Discord không hợp lệ hoặc bot không gửi được: ${channelId}`,
		);
	}

	const safeTitle = title.replace(/@/g, '@\u200b');
	const templates = [
		'📺 WINHP vừa thả video mới, vào xem liền nha: **{title}**',
		'🎬 Video mới lên sóng rồi! Cả nhà xem thử nè: **{title}**',
		'✨ Hàng mới của WINHP đây bà con ơi: **{title}**',
		'👀 Có video mới rồi, cùng WINHP xem nào: **{title}**',
		'🚨 Tin nóng: WINHP vừa đăng video mới — **{title}**',
	];
	const roleMention = config.youtubeVideoNotificationRoleId
		? `<@&${config.youtubeVideoNotificationRoleId}> `
		: '';
	await channel.send({
		content: `${roleMention}${pickRandomTemplate(
			'YouTube-video',
			templates,
			lastVideoTemplateIndexes,
		).replace('{title}', safeTitle)}\nhttps://www.youtube.com/watch?v=${videoId}`,
		allowedMentions: {
			roles: config.youtubeVideoNotificationRoleId
				? [config.youtubeVideoNotificationRoleId]
				: [],
		},
	});
	console.log('[YouTube] Đã gửi thông báo video mới.');
}

function youtubeChannelReference(value) {
	const channelIdMatch = value.match(/(?:youtube\.com\/channel\/)?(UC[\w-]{22})/i);
	if (channelIdMatch) return { channelId: channelIdMatch[1] };

	const handleMatch = value.match(/@([\w.-]+)/);
	if (handleMatch) return { handle: handleMatch[1] };

	const handle = value.trim().replace(/^@/, '');
	return handle ? { handle } : null;
}

async function youtubeApiRequest(params) {
	const url = new URL('https://www.googleapis.com/youtube/v3/' + params.endpoint);
	for (const [key, value] of Object.entries(params.query)) {
		url.searchParams.set(key, value);
	}
	url.searchParams.set('key', config.youtubeApiKey);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`YouTube API trả về HTTP ${response.status}. Kiểm tra API key/quota.`);
	}
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
		if (!reference) throw new Error('YOUTUBE_CHANNEL đang trống hoặc không hợp lệ.');

		const query = { part: 'id,contentDetails' };
		if (reference.channelId) query.id = reference.channelId;
		else query.forHandle = reference.handle;

		const data = await youtubeApiRequest({ endpoint: 'channels', query });
		const channel = data.items?.[0];
		const channelId = channel?.id;
		const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
		if (!channelId) {
			throw new Error('Không tìm thấy kênh YouTube. Dùng link /channel/UC... hoặc @handle.');
		}
		if (!uploadsPlaylistId) {
			throw new Error('Không tìm thấy uploads playlist của kênh YouTube.');
		}
		cachedYoutubeChannelId = channelId;
		youtubeUploadsPlaylistId = uploadsPlaylistId;
	}
}

async function checkYouTubeLive() {
	if (!config.youtubeNotificationChannelId) return;

	const data = await youtubeApiRequest({
		endpoint: 'search',
		query: {
			part: 'id',
			channelId: cachedYoutubeChannelId,
			eventType: 'live',
			type: 'video',
			maxResults: '1',
		},
	});
	const videoId = data.items?.[0]?.id?.videoId;

	if (!videoId) {
		announcedYoutubeLiveId = undefined;
		return;
	}
	if (videoId === announcedYoutubeLiveId) return;

	await postLiveAlert(
		'YouTube',
		config.youtubeNotificationChannelId,
		`https://www.youtube.com/watch?v=${videoId}`,
	);
	announcedYoutubeLiveId = videoId;
	announcedYoutubeLiveIds.add(videoId);
}

async function checkYouTubeVideos() {
	if (!config.youtubeVideoNotificationChannelId) return;

	const data = await youtubeApiRequest({
		endpoint: 'playlistItems',
		query: {
			part: 'snippet',
			playlistId: youtubeUploadsPlaylistId,
			maxResults: '1',
		},
	});
	const latestVideo = data.items?.[0]?.snippet;
	const videoId = latestVideo?.resourceId?.videoId;

	if (!initializedYoutubeVideos) {
		announcedYoutubeUploadId = videoId;
		initializedYoutubeVideos = true;
		return;
	}
	if (!videoId || videoId === announcedYoutubeUploadId) return;

	if (announcedYoutubeLiveIds.has(videoId) || videoId === announcedYoutubeLiveId) {
		announcedYoutubeUploadId = videoId;
		return;
	}

	const details = await youtubeApiRequest({
		endpoint: 'videos',
		query: {
			part: 'snippet,liveStreamingDetails',
			id: videoId,
		},
	});
	const video = details.items?.[0];
	if (!video) {
		throw new Error(`Không lấy được thông tin video YouTube: ${videoId}`);
	}

	if (
		video.snippet?.liveBroadcastContent !== 'none' ||
		video.liveStreamingDetails
	) {
		announcedYoutubeUploadId = videoId;
		return;
	}

	await postYoutubeVideoAlert(
		video.snippet?.title ?? latestVideo.title ?? 'Video mới',
		videoId,
	);
	announcedYoutubeUploadId = videoId;
}

async function checkYouTube() {
	await ensureYoutubeChannel();
	await checkYouTubeLive();
	await checkYouTubeVideos();
}

function tiktokUsername(value) {
	const handleMatch = value.match(/@([\w.-]+)/);
	return (handleMatch?.[1] ?? value.trim().replace(/^@/, '')).replace(/\/$/, '');
}

const tiktokConnection = config.tiktokAccount
	? new TikTokLiveConnection(tiktokUsername(config.tiktokAccount), {})
	: null;
let wasTikTokLive = false;

async function checkTikTokLive() {
	if (!tiktokConnection) return;

	const isLive = await tiktokConnection.fetchIsLive();
	if (isLive && !wasTikTokLive) {
		const username = tiktokUsername(config.tiktokAccount);
		await postLiveAlert(
			'TikTok',
			config.tiktokNotificationChannelId,
			`https://www.tiktok.com/@${username}/live`,
		);
	}
	wasTikTokLive = isLive;
}

client.login(config.discordToken);
