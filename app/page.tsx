// ...imports unchanged...

// inside handleGenerate()
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: prompt, prompt }),
});

let dataText = "";
try { dataText = await res.text(); } catch {}
if (!res.ok) {
  // Show server's detail if present
  appendLog(`✖ ${res.status} ${res.statusText}\n${dataText || "(no body)"}`);
  throw new Error("Server error");
}
const data = JSON.parse(dataText) as GenResult;
// ...rest unchanged...
