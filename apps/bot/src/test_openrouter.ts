import "dotenv/config";

async function test() {
  const key = process.env.OPENROUTER_KEY;
  const model = process.env.OPENROUTER_MODEL;

  console.log("Key:", key?.slice(0, 20) + "...");
  console.log("Model:", model);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You extract car names from text. Reply with JSON only." },
        { role: "user", content: "Ищу Toyota Prius 2022" }
      ]
    })
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text.slice(0, 500));
}

test();
