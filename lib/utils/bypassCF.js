export async function turnstileBypass(target, sitekey) {
  try {
     const res2 = await fetch(`https://kyuurzy.dev/tools/turnstile-min?url=${encodeURIComponent(target)}&siteKey=${encodeURIComponent(sitekey)}`);
     const data2 = await res2.json();
     return data2.token;
  } catch (e) {
     console.log(e.stack);
  }
}
