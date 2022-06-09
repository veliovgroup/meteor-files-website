import { ReactiveVar } from 'meteor/reactive-var';
// meteor add ostrio:cstorage
import { ClientStorage } from 'meteor/ostrio:cstorage';
const clientStorage = new ClientStorage();

const persistentReactive = (name, initial) => {
  let reactive;
  if (clientStorage.has(name)) {
    reactive = new ReactiveVar(clientStorage.get(name));
  } else {
    clientStorage.set(name, initial);
    reactive = new ReactiveVar(initial);
  }

  reactive.set = function (newValue) {
    let oldValue = reactive.curValue;
    if ((reactive.equalsFunc || ReactiveVar._isEqual)(oldValue, newValue)) {
      return;
    }
    reactive.curValue = newValue;
    clientStorage.set(name, newValue);
    reactive.dep.changed();
  };

  return reactive;
};

export { persistentReactive };
