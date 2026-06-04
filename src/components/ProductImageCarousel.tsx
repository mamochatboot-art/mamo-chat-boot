import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductImageCarouselProps {
  productId: string;
  productName: string;
}

export const getProductImages = (productId: string): string[] => {
  if (productId === "prod-1") {
    // Premium bubbles chocolate
    return [
      "https://images.unsplash.com/photo-1548907040-4d42b52145ca?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&q=80&w=400",
    ];
  }
  if (productId === "prod-2") {
    // Damascus cardamom coffee
    return [
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=400",
    ];
  }
  if (productId === "prod-3") {
    // Cocoa with Syrian rose
    return [
      "https://images.unsplash.com/photo-1544787219-7f41ccb56574?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1571934811356-5cc561b63d2c?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1515688594390-b649af70d282?auto=format&fit=crop&q=80&w=400",
    ];
  }
  return [
    "https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&q=80&w=400",
  ];
};

export const ProductImageCarousel: React.FC<ProductImageCarouselProps> = ({ productId, productName }) => {
  const images = getProductImages(productId);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-gray-200 group bg-gray-100 select-none">
      <img
        src={images[currentIndex]}
        alt={`${productName} - ${currentIndex + 1}`}
        className="w-full h-full object-cover transition-all duration-300"
      />
      
      {images.length > 1 && (
        <>
          {/* Slide buttons */}
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/55 text-white hover:bg-black/75 transition opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10 cursor-pointer"
            aria-label="Previous Image"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/55 text-white hover:bg-black/75 transition opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10 cursor-pointer"
            aria-label="Next Image"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          
          {/* Small dot indicators */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
            {images.map((_, i) => (
              <span
                key={i}
                className={`w-1 h-1 rounded-full transition-all ${
                  i === currentIndex ? "bg-[#c9a227] scale-125" : "bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
