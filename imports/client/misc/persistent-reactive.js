import { ReactiveVar } from 'meteor/reactive-var';
// meteor add ostrio:cstorage
import { ClientStorage } from 'meteor/ostrio:cstorage';

const persistentReactive = (name, initial) => {
  let reactive;
  if (ClientStorage.has(name)) {
    reactive = new ReactiveVar(ClientStorage.get(name));
  } else {
    ClientStorage.set(name, initial);
    reactive = new ReactiveVar(initial);
  }

  reactive.set = function (newValue) {
    let oldValue = reactive.curValue;
    if ((reactive.equalsFunc || ReactiveVar._isEqual)(oldValue, newValue)) {
      return;
    }
    reactive.curValue = newValue;
    ClientStorage.set(name, newValue);
    reactive.dep.changed();
  };

  return reactive;
};

export { persistentReactive };
