// ================================
//  Interactive Film Wall Script
//  Author: Martinn 🌀
// ================================

// 👇 Replace this with YOUR Google Apps Script Web App URL
const scriptURL = "https://script.google.com/macros/s/AKfycbyKL6xqkA83Qd0SMwF9494GKoRbN1hoLMc7JKUlEH_3bt-K-zhO0dgkVuoVTp20Yags/exec";

// Wait until the page finishes loading
document.addEventListener("DOMContentLoaded", loadDriveFiles);

async function loadDriveFiles() {
  try {
    const response = await fetch(scriptURL);
    const files = await response.json();
    const gallery = document.getElementById("gallery");

    if (!gallery) {
      console.error("❌ Missing <div id='gallery'> in HTML.");
      return;
    }

    // Clear gallery before loading
    gallery.innerHTML = "";

    files.forEach(file => {
      const item = document.createElement("div");
      item.className = "media-item";

      // IMAGE
      if (file.mimeType.includes("image")) {
        const img = document.createElement("img");
        img.src = file.url.replace("view?usp=drivesdk", "preview");
        img.alt = file.name;
        item.appendChild(img);
      }

      // VIDEO
      else if (file.mimeType.includes("video")) {
        const video = document.createElement("video");
        video.src = file.url.replace("view?usp=drivesdk", "preview");
        video.controls = true;
        video.preload = "metadata";
        item.appendChild(video);
      }

      // AUDIO
      else if (file.mimeType.includes("audio")) {
        const audio = document.createElement("audio");
        audio.src = file.url.replace("view?usp=drivesdk", "preview");
        audio.controls = true;
        item.appendChild(audio);
      }

      // FILE NAME LABEL (optional aesthetic)
      const caption = document.createElement("p");
      caption.className = "caption";
      caption.textContent = file.name;
      item.appendChild(caption);

      gallery.appendChild(item);
    });

    console.log("✅ Loaded " + files.length + " files from Drive.");
  } catch (error) {
    console.error("⚠️ Error loading files:", error);
  }
}
