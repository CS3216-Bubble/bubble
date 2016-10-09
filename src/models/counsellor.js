class Counsellor {
  counsellorId: string;
  counsellorName: string;
  socket: Object;
  lastOnline: Date;

  constructor(
    counsellorId,
    counsellorName,
    socket: null,
  ) {
    this.counsellorId = counsellorId;
    this.counsellorName = counsellorName;
    this.socket = socket;
    this.lastOnline = null;
  }

  get isOnline() {
    return this.socket !== null;
  }

  goOnline(socket) {
    this.socket = socket;
    this.lastOnline = new Date();
  }

  goOffline(socket) {
    this.socket = null;
    this.lastOnline = new Date();
  }

  get toJson() {
    let lastOnline = this.last;
    if (this.lastOnline === null) {
      lastOnline = null;
    } else {
      lastOnline = this.lastOnline.toISOString;
    }

    return {
      counsellerId: this.counsellorId,
      counsellerName: this.counsellorName,
      lastOnline,
    };
  }

}

export default Counsellor;
