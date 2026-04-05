const map = new Map();
map.set(1, new Set());
map.set(2, new Set());
map.get(1).add("KarunSocket").add("Kamala");
map.get(2).add("KarunaSocket");
console.log("Currently: ", map);
const users = map.get(1);
users.delete("KarunSockets")
console.log("After", map);

