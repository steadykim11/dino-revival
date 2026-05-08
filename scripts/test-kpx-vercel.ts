import https from "node:https";

const url = `https://openapi.kpx.or.kr/openapi/sukub5mMaxDatetime/getSukub5mMaxDatetime?serviceKey=${process.env.KPX_API_KEY}&pageNo=1&numOfRows=1`;

console.log("Trying with node:https...");
https
  .get(url, (res) => {
    console.log("Status:", res.statusCode);
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => console.log("Body length:", body.length));
  })
  .on("error", (e) => console.error("Error:", e));
