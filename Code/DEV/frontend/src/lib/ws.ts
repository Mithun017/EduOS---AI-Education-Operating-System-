export const WS_BASE_URL = "ws://localhost:8000";

export class EduOSWebSocket {
  private ws: WebSocket | null = null;
  private conversationId: string;
  private token: string;
  private mode: "teacher" | "student";
  private onMessageCallback: (data: any) => void;
  private onErrorCallback?: (err: Event) => void;
  private onCloseCallback?: (code: number, reason: string) => void;

  constructor(
    conversationId: string,
    token: string,
    mode: "teacher" | "student",
    onMessage: (data: any) => void,
    onError?: (err: Event) => void,
    onClose?: (code: number, reason: string) => void
  ) {
    this.conversationId = conversationId;
    this.token = token;
    this.mode = mode;
    this.onMessageCallback = onMessage;
    this.onErrorCallback = onError;
    this.onCloseCallback = onClose;
  }

  connect() {
    const url = `${WS_BASE_URL}/api/v1/${this.mode}-assistant/ws/${this.conversationId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Step 1: Send first-frame auth handshake frame immediately
      const authFrame = {
        type: "auth",
        token: this.token
      };
      this.ws?.send(JSON.stringify(authFrame));
      console.log(`EduOS WS connected for conversation: ${this.conversationId}, auth payload sent.`);
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.onMessageCallback(parsed);
      } catch (err) {
        console.error("Error parsing WS frame data:", err);
      }
    };

    this.ws.onerror = (event) => {
      console.error("EduOS WS error occurred:", event);
      if (this.onErrorCallback) {
        this.onErrorCallback(event);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`EduOS WS closed. Code: ${event.code}, Reason: ${event.reason}`);
      if (this.onCloseCallback) {
        this.onCloseCallback(event.code, event.reason);
      }
    };
  }

  sendQuery(message: string, topicId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("Cannot send query: WebSocket is not open.");
      return;
    }
    const queryFrame = {
      message,
      topic_id: topicId
    };
    this.ws.send(JSON.stringify(queryFrame));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
