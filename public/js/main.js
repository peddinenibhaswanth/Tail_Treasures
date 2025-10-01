document.addEventListener("DOMContentLoaded", () => {
  // Initialize tooltips
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  var tooltipList = tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl));

  // Auto-dismiss alerts after 5 seconds
  setTimeout(() => {
    var alerts = document.querySelectorAll(".alert");
    alerts.forEach((alert) => {
      var bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    });
  }, 5000);

  // Image preview for file inputs
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach((input) => {
    input.addEventListener("change", function () {
      const previewId = this.dataset.preview;
      if (previewId) {
        const preview = document.getElementById(previewId);
        if (preview && this.files && this.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            preview.src = e.target.result;
          };
          reader.readAsDataURL(this.files[0]);
        }
      }
    });
  });

  // Pet image gallery
  const thumbnails = document.querySelectorAll(".pet-thumbnail");
  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", function () {
      const mainImage = document.querySelector(".pet-detail-image");
      if (mainImage) {
        mainImage.src = this.src;
      }
    });
  });

  // Shopping cart functionality
  const addToCartButtons = document.querySelectorAll(".add-to-cart");
  addToCartButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      const productId = this.dataset.productId;
      const quantity = document.querySelector(`#quantity-${productId}`)?.value || 1;
      fetch("/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            const cartCount = document.getElementById("cart-count");
            if (cartCount) {
              cartCount.textContent = data.cartCount;
            }
            const toast = document.createElement("div");
            toast.className = "position-fixed bottom-0 end-0 p-3";
            toast.style.zIndex = "11";
            toast.innerHTML = `
              <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                  <strong class="me-auto">Success</strong>
                  <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                  Product added to cart successfully!
                </div>
              </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
              toast.remove();
            }, 3000);
            updateCartCount();
          }
        })
        .catch((error) => {
          console.error("Error adding to cart:", error);
        });
    });
  });

  // Quantity increment/decrement
  const decrementButtons = document.querySelectorAll(".quantity-decrement");
  const incrementButtons = document.querySelectorAll(".quantity-increment");
  decrementButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const input = this.nextElementSibling;
      const value = Number.parseInt(input.value);
      if (value > 1) {
        input.value = value - 1;
      }
    });
  });
  incrementButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const input = this.previousElementSibling;
      const value = Number.parseInt(input.value);
      input.value = value + 1;
    });
  });

  // Debug form submissions
  const forms = document.querySelectorAll("form");
  forms.forEach((form) => {
    form.addEventListener("submit", (e) => {
      console.log(`Form submitting to: ${form.action}`);
    });
  });
});

// Update cart count in navbar
function updateCartCount() {
  fetch("/cart/count")
    .then((response) => response.json())
    .then((data) => {
      const cartCountElement = document.querySelector(".cart-count");
      if (cartCountElement) {
        cartCountElement.textContent = data.count;
        if (data.count === 0) {
          cartCountElement.classList.add("d-none");
        } else {
          cartCountElement.classList.remove("d-none");
        }
      }
    })
    .catch((error) => console.error("Error fetching cart count:", error));
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".cart-count")) {
    updateCartCount();
  }
});