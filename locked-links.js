(function() {
    "use strict";

    var box = document.getElementById("lockedLinks");
    var modal = document.getElementById("pwModal");
    var form = document.getElementById("pwForm");
    var input = document.getElementById("pwInput");
    var err = document.getElementById("pwErr");
    if (!box || !modal) return;
    var canCrypto = !!(window.crypto && crypto.subtle);

    var pending = null;
    var cache = {};

    function b64(s) {
        var bin = atob(s);
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function decrypt(name, password) {
        var enc = new TextEncoder();
        var parts = box.dataset[name].split(".");
        return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
            .then(function(base) {
                return crypto.subtle.deriveKey(
                    { name: "PBKDF2", salt: b64(box.dataset.s), iterations: 250000, hash: "SHA-256" },
                    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
            })
            .then(function(key) {
                return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(parts[0]) }, key, b64(parts[1]));
            })
            .then(function(buf) { return new TextDecoder().decode(buf); });
    }

    function openUrl(url) {
        window.open(url, "_blank", "noopener,noreferrer");
    }

    function closeModal() {
        modal.hidden = true;
        input.value = "";
        input.type = "password";
        input.classList.remove("is-invalid");
        err.classList.add("pw-err");
        document.getElementById("pwEye").classList.remove("is-on");
        err.hidden = true;
        pending = null;
    }

    box.addEventListener("click", function(event) {
        var link = event.target.closest("[data-lock]");
        if (!link) return;
        event.preventDefault();
        if (!canCrypto) {
            alert("Trình duyệt cần mở trang bằng HTTPS để nhập mật khẩu. Hãy mở bản trang chính thức.");
            return;
        }
        var name = link.dataset.lock;
        if (cache[name]) { openUrl(cache[name]); return; }
        pending = name;
        modal.hidden = false;
        input.focus();
    });

    form.addEventListener("submit", function(event) {
        event.preventDefault();
        var name = pending;
        if (!name) return;
        if (!input.value.trim()) {
            err.textContent = "Vui lòng nhập mật khẩu.";
            err.hidden = false;
            input.classList.add("is-invalid");
            input.focus();
            return;
        }
        err.textContent = "Đang kiểm tra...";
        err.hidden = false;
        err.classList.remove("pw-err");
        decrypt(name, input.value.trim().toLowerCase()).then(function(url) {
            cache[name] = url;
            closeModal();
            openUrl(url);
        }).catch(function() {
            err.textContent = "Sai mật khẩu, vui lòng thử lại.";
            err.classList.add("pw-err");
            input.classList.add("is-invalid");
            input.select();
        });
    });

    input.addEventListener("input", function() {
        err.hidden = true;
        input.classList.remove("is-invalid");
    });

    document.getElementById("pwCancel").addEventListener("click", closeModal);
    var eye = document.getElementById("pwEye");
    eye.addEventListener("click", function() {
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        eye.setAttribute("aria-pressed", String(show));
        eye.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
        eye.classList.toggle("is-on", show);
        input.focus();
    });
    modal.addEventListener("click", function(event) { if (event.target === modal) closeModal(); });
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape" && !modal.hidden) closeModal();
    });
})();
