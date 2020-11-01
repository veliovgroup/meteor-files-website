import { Meteor } from 'meteor/meteor';

const webPush = {
  isSupported: 'serviceWorker' in navigator && 'PushManager' in window,
  isEnabled: false,
  publicKey: Meteor.settings.public?.vapid?.publicKey,
  // CHECK AND ENSURE PUSH NOTIFICATIONS ENABLED IN THIS BROWSER
  async check() {
    if (!this.publicKey || !this.isSupported) {
      return false;
    }

    const swRegistration = await navigator.serviceWorker.ready;
    if (swRegistration && 'pushManager' in swRegistration) {
      const subscription = await swRegistration.pushManager.getSubscription();

      if (subscription) {
        this.isEnabled = false;
        this.subscription = JSON.stringify(subscription);
        return true;
      }
    }

    return await this.enable();
  },
  // DISABLE/UNSUBSCRIBE PUSH NOTIFICATIONS
  async disable() {
    if (!this.publicKey || !this.isSupported) {
      return false;
    }

    try {
      const swRegistration = await navigator.serviceWorker.ready;
      if (swRegistration && 'pushManager' in swRegistration) {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
        this.isEnabled = false;
        this.subscription = void 0;

        return true;
      }
    } catch (disableError) {
      console.error('[webPush.disable] Error:', disableError);
    }

    return false;
  },
  // ENABLE PUSH NOTIFICATIONS
  // ASK FOR USER PERMISSIONS IF NECESSARY
  async enable() {
    if (!this.publicKey || !this.isSupported) {
      return false;
    }

    try {
      const consent = await Notification.requestPermission();

      if (consent === 'granted') {
        const swRegistration = await navigator.serviceWorker.ready;
        if (!('pushManager' in swRegistration)) {
          return false;
        }

        const subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.publicKey
        });

        this.subscription = JSON.stringify(subscription);
        this.isEnabled = true;
        return true;
      }
    } catch (enableError) {
      console.error('[webPush.enable] Error:', enableError);
    }

    return false;
  }
};

export { webPush };
