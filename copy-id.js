/*
  Copy Branch ID functionality
*/

(function() {
    "use strict";

    function setupCopyListeners() {
        var branchCards = document.querySelectorAll(".branch-card");
        
        for (var i = 0; i < branchCards.length; i++) {
            var card = branchCards[i];
            card.addEventListener("click", function(e) {
                if (e.target.tagName === "A" || e.target.tagName === "BUTTON") {
                    return;
                }

                var idText = this.dataset.id;
                if (!idText) return;

                // Copy to clipboard
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(idText);
                } else {
                    var tempInput = document.createElement("textarea");
                    tempInput.value = idText;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand("copy");
                    document.body.removeChild(tempInput);
                }
                
                // Show feedback
                var hint = this.querySelector(".copy-hint");
                if (hint) {
                    var originalText = hint.textContent;
                    hint.textContent = "✓ Đã sao chép!";
                    setTimeout(function() {
                        hint.textContent = originalText;
                    }, 2000);
                }
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupCopyListeners);
    } else {
        setupCopyListeners();
    }
})();
