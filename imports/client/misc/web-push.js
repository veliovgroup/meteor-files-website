import { Meteor } from 'meteor/meteor';

const webPush = {
  isEnabled: false,
  publicKey: Meteor.settings.public?.vapid?.publicKey,
  // CHECK AND ENSURE PUSH NOTIFICATIONS ENABLED IN THIS BROWSER
  async check() {
    if (!this.publicKey) {
      return;
    }

    const swRegistration = await navigator.serviceWorker.ready;
    const subscription = await swRegistration.pushManager.getSubscription();

    if (subscription) {
      this.isEnabled = false;
      this.subscription = JSON.stringify(subscription);
    } else {
      this.enable();
    }
  },
  // DISABLE/UNSUBSCRIBE PUSH NOTIFICATIONS
  async disable() {
    if (!this.publicKey) {
      return;
    }

    try {
      const swRegistration = await navigator.serviceWorker.ready;
      if (swRegistration && 'PushManager' in window) {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
        this.isEnabled = false;
        this.subscription = void 0;
      }
    } catch (disableError) {
      console.error('[webPush.disable] Error:', disableError);
    }
  },
  // ENABLE PUSH NOTIFICATIONS
  // ASK FOR USER PERMISSIONS IF NECESSARY
  async enable() {
    if (!this.publicKey) {
      return;
    }

    try {
      const consent = await Notification.requestPermission();

      if (consent === 'granted') {
        const swRegistration = await navigator.serviceWorker.ready;
        const subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.publicKey
        });

        this.subscription = JSON.stringify(subscription);
        this.isEnabled = true;
      }
    } catch (enableError) {
      console.error('[webPush.enable] Error:', enableError);
    }
  }
};

export { webPush };
