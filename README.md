# Snake-Game

## Local Run

1. Start the server:
	- `cd server`
	- `npx tsx index.ts`
2. Start the client in a second terminal:
	- `cd client`
	- `npx vite`
3. Open two browser tabs at the Vite URL and press Ready Up in both tabs.

## Why You Might See A Snake Before Ready Up

- The lobby can still have a previously joined player for a few seconds if a tab was just closed/reloaded.
- Snakes are now rendered only when game status is PLAYING, so you should not see active snakes while waiting.

## Play With A Friend (Internet)

Use a tunnel so your friend can reach both your client and server.

1. Expose your server (port 3000) with a tunnel tool like ngrok or Cloudflare Tunnel.
2. Expose your client (Vite port, usually 5173 or 5174) with another tunnel.
3. Add your server tunnel URL as a query parameter when opening the client:
	- `?server=https://your-server-tunnel-url`
4. Share that full client URL with your friend.

Example:

- Server tunnel: `https://abc123.ngrok-free.app`
- Client URL to share:
	- `https://your-client-tunnel-url?server=https://abc123.ngrok-free.app`

Then both players open the client URL and press Ready Up.
