const luaBadge = document.getElementById("luaBadge");
const luaModal = document.getElementById("luaModal");
const fecharLua = document.getElementById("fecharLua");

luaBadge.addEventListener("click", () => {
  luaModal.style.display = "flex";
});

fecharLua.addEventListener("click", () => {
  luaModal.style.display = "none";
});

luaModal.addEventListener("click", (e) => {
  if (e.target === luaModal) {
    luaModal.style.display = "none";
  }
});
