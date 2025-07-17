const $ = (id) => document.getElementById(id);

const elapsed = (dateOld, dateNew) => {
  const elapsedMs = dateNew - dateOld;

  const seconds = Math.floor(elapsedMs / 1000);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    hrs.toString().padStart(2, "0"),
    mins.toString().padStart(2, "0"),
    secs.toString().padStart(2, "0"),
  ].join(":");
};

function getRandomElements(arr, count) {
  const result = [];
  const usedIndices = new Set();

  while (result.length < count && usedIndices.size < arr.length) {
    const index = Math.floor(Math.random() * arr.length);
    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      result.push([index, arr[index]]);
    }
  }

  return result;
}

const initTwitchListener = (channel, dispatchElem) => {
  const chat = new WebSocket("wss://irc-ws.chat.twitch.tv");
  const timeout = setTimeout(() => {
    chat.close();
    chat.connect();
  }, 10000);

  chat.onopen = function () {
    clearInterval(timeout);
    chat.send(
      "CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership",
    );
    chat.send("PASS oauth:xd123");
    chat.send("NICK justinfan123");
    chat.send("JOIN #" + channel);
    console.log("Connected to Twitch IRC");
  };

  chat.onerror = function () {
    console.error("There was an error.. disconnected from the IRC");
    chat.close();
    chat.connect();
  };

  chat.onmessage = function (event) {
    const usedMessage = event.data.split(/\r\n/)[0];
    const textStart = usedMessage.indexOf(` `); // tag part ends at the first space
    const fullMessage = usedMessage.slice(0, textStart).split(`;`); // gets the tag part and splits the tags
    fullMessage.push(usedMessage.slice(textStart + 1));

    if (fullMessage.length <= 13) return;

    const parsedMessage = fullMessage[fullMessage.length - 1]
      .split(`${channel} :`)
      .pop(); // gets the raw message
    let message = parsedMessage.split(" ").includes("ACTION")
      ? parsedMessage.split("ACTION ").pop().split("")[0]
      : parsedMessage; // checks for the /me ACTION usage and gets the specific message

    // ignore messages that arent from the broadcaster
    if (!event.data.includes("badges=broadcaster")) return;

    if (message.startsWith("!spin"))
      dispatchElem.dispatchEvent(new CustomEvent("spin"));
    if (message.startsWith("!start"))
      dispatchElem.dispatchEvent(new CustomEvent("start"));
    if (message.startsWith("!finish"))
      dispatchElem.dispatchEvent(new CustomEvent("finish"));
  };
};

class Application {
  constructor() {
    const params = new URLSearchParams(window.location.search);

    this.channel = params.get("channel");
    this.version = params.get("version");
    this.item = null;
    this.items = null;
    this.timeStarted = null;
    this.ui = {
      body: document.querySelector("body"),
      slotsGuide: $("slotsGuide"),
      result: $("result"),
      finishingTime: $("finishingTime"),
      timer: $("timer"),
      runInfo: $("runInfo"),
      error: $("error"),
      channel: $("channel"),
      version: $("version"),
      cardStrip: $("cardStrip"),
      slotContainer: $("slotContainer"),
      block: $("block"),
    };

    if (!this.channel) {
      this.ui.error.innerText = "No Twitch channel provided!";
      this.ui.error.style.display = "block";
      return;
    }

    const query = infer(this.version);
    if (!query) {
      this.ui.error.innerText = "The version provided is not available!";
      this.ui.error.style.display = "block";
      return;
    }

    this.items = query.items;
    this.ui.channel.innerText = this.channel;
    this.ui.version.innerText = query.label;
    this.version = query.label;

    console.log(`Starting at #${this.channel} with version ${query.label}`);

    initTwitchListener(this.channel, this.ui.body);

    this.ui.body.addEventListener("spin", () => this.spin());
    this.ui.body.addEventListener("start", () => this.start());
    this.ui.body.addEventListener("finish", () => this.end());
  }

  spin() {
    console.log("===== SPIN =====");

    const audio = new Audio("/static/slot.mp3");
    audio.volume = 0.05;

    this.ui.slotContainer.style.display = "block";
    this.ui.result.style.display = "none";
    this.ui.runInfo.style.display = "none";

    const items = getRandomElements(this.items, 10);

    this.ui.cardStrip.innerHTML = "";
    items.forEach(([idx, it]) => {
      this.ui.cardStrip.innerHTML += `
        <div class="card" data-id="${idx}">
          <img
            width=160
            height=160
            class="card-img"
            src="/static/items/${this.version}/${it.name}.png"
            alt="${it.displayName}"
          />
          <span>${it.displayName}</span>
        </div>
      `;
    });

    const cardWidth = 400;
    let offset = 0;
    let interval;
    let isSpinning = false;

    const startSpin = () => {
      if (isSpinning) return;
      isSpinning = true;

      interval = setInterval(() => {
        offset += cardWidth;
        this.ui.cardStrip.style.transition = "none";
        this.ui.cardStrip.style.transform = `translateX(-${offset}px)`;

        if (offset >= this.ui.cardStrip.scrollWidth - cardWidth) {
          offset = 0;
        }
      }, 100);
    };

    const stopSpin = () => {
      clearInterval(interval);

      const totalCards = this.ui.cardStrip.children.length;
      const chosenIndex = Math.floor(Math.random() * totalCards);

      offset = chosenIndex * cardWidth;
      this.ui.cardStrip.style.transition = "transform 0.5s ease-out";
      this.ui.cardStrip.style.transform = `translateX(-${offset}px)`;

      isSpinning = false;
      console.log(
        "Chosen card index:",
        this.ui.cardStrip.children[chosenIndex].dataset.id,
      );

      this.item =
        this.items[this.ui.cardStrip.children[chosenIndex].dataset.id];
    };

    audio.play();
    startSpin();
    setTimeout(stopSpin, 4000);
  }

  start() {
    console.log("===== START =====");

    this.ui.slotContainer.style.display = "none";

    this.timeStarted = new Date();
    this.ui.timer.innerText = "00:00:00";

    this.ui.slotsGuide.style.display = "none";
    this.ui.block.innerText = this.item.displayName;
    this.ui.runInfo.style.display = "block";

    this._timerUpdaterHandle = setInterval(() => {
      this.ui.timer.innerText = elapsed(this.timeStarted, new Date());
    }, 1000);
  }

  end() {
    console.log("===== END =====");

    this.ui.finishingTime.innerText = elapsed(this.timeStarted, new Date());
    this.ui.result.style.display = "block";
    clearInterval(this._timerUpdaterHandle);

    new JSConfetti().addConfetti();
    const audio = new Audio("/static/yay.mp3");
    audio.volume = 0.05;
    audio.play();
  }
}
