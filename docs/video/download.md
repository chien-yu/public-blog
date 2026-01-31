# 下載

[`yt-dlp`](https://github.com/yt-dlp/yt-dlp) 要繞過一些 cookies 的限制很方便。

```
yt-dlp --add-header "Referer:WEBSITE" \
       --user-agent "YOUR_USER_AGENT" \
       --add-header "Cookie:e=EXPIRY; p=YOUR_PAYLOAD; h=YOUR_HASH" \
       "VIDEO_M3U8_URL"
```

Cookies 就透過瀏覽器的 Network 頁面，找到 m3u8 的 request，按右鍵選擇 Copy as cURL 就會幫你抓出來了。
