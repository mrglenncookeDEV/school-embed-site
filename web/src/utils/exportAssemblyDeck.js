import logo from "/favicon.png";
import { renderWaffleImage } from "./renderWaffleImage";
let pptxLoader = null;

const ensurePptx = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);

  if (!pptxLoader) {
    pptxLoader = (async () => {
      const loadScriptFromText = async (text) => {
        const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = blobUrl;
          script.async = true;
          script.onload = () => {
            URL.revokeObjectURL(blobUrl);
            resolve();
          };
          script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error("Script load failed"));
          };
          document.head.appendChild(script);
        });
      };

      const loadUrl = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed: ${url}`);
        const text = await res.text();
        await loadScriptFromText(text);
      };

      const zipUrls = [
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
        "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
      ];

      const tryUrls = [
        "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.min.js",
        "https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.min.js",
      ];

      // Ensure JSZip present
      if (!window.JSZip) {
        let zipLoaded = false;
        for (const url of zipUrls) {
          try {
            await loadUrl(url);
            zipLoaded = true;
            break;
          } catch (err) {
            console.warn("JSZip load failed", url, err);
          }
        }
        if (!zipLoaded && !window.JSZip) {
          throw new Error("JSZip not available");
        }
      }

      for (const url of tryUrls) {
        try {
          await loadUrl(url);
          if (window.PptxGenJS) return window.PptxGenJS;
        } catch (err) {
          console.warn("pptxgen load attempt failed", url, err);
        }
      }

      throw new Error("pptxgenjs not available");
    })();
  }

  return pptxLoader;
};

function addLogo(slide) {
  slide.addImage({
    data: logo,
    x: 9.0,
    y: 0.3,
    w: 0.6,
    h: 0.6,
  });
}

export async function exportAssemblyDeck({
  view,
  totalValues,
  houses,
  colours,
}) {
  const PptxGenJS = await ensurePptx().catch((err) => {
    console.error("pptxgenjs load failed", err);
    return null;
  });
  if (!PptxGenJS) {
    throw new Error("Unable to load pptx generator");
  }

  const pptx = new PptxGenJS();

  /* TITLE */
  const title = pptx.addSlide();
  addLogo(title);
  title.addText("Living our values through points", {
    x: 1,
    y: 1.5,
    fontSize: 36,
    bold: true,
  });
  title.addText(view === "week" ? "This week" : "This term", {
    x: 1,
    y: 2.5,
    fontSize: 20,
  });

  /* WHOLE SCHOOL */
  const totalSlide = pptx.addSlide();
  addLogo(totalSlide);
  totalSlide.addText("Whole school", {
    x: 0.5,
    y: 0.3,
    fontSize: 24,
    bold: true,
  });
  totalSlide.addImage({
    data: renderWaffleImage({ data: totalValues, colours }),
    x: 1,
    y: 1,
    w: 5,
    h: 5,
  });

  /* HOUSES */
  for (const house of houses) {
    const slide = pptx.addSlide();
    addLogo(slide);
    slide.addText(house.name, {
      x: 0.5,
      y: 0.3,
      fontSize: 24,
      bold: true,
    });
    slide.addImage({
      data: renderWaffleImage({ data: house.data, colours }),
      x: 1,
      y: 1,
      w: 4.5,
      h: 4.5,
    });
    if (house.caption) {
      slide.addText(house.caption, {
        x: 1,
        y: 6.2,
        fontSize: 16,
      });
    }
  }

  await pptx.writeFile(`Values-${view}.pptx`);
}
