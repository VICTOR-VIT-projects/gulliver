# Gulliver

**Every city, sized up.** A tour intelligence agent for independent promoters, venues and talent agents, grounded in [Qloo](https://qloo.com)'s taste graph. Built for the Qloo Agentic Hackathon.

> Work in progress. The full README (problem, Qloo endpoints used, walkthrough, setup, limitations) lands before submission.

## Run locally

```bash
git clone https://github.com/VICTOR-VIT-projects/gulliver && cd gulliver
cp .env.example .env   # add QLOO_API_KEY and OPENROUTER_API_KEY
npm install
npm run spike          # checks every Qloo call Gulliver uses
npm run dev
```

## License

[MIT](LICENSE)
