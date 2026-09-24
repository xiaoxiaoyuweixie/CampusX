const CATEGORY_ICONS = {
  digital: '/images/home/category-digital.png',
  kaoyan: '/images/home/category-kaoyan.png',
  book: '/images/home/category-book.png',
  skill: '/images/home/category-skill.png',
  dorm: '/images/home/category-dorm.png',
};

const CATEGORY_PAGE_ICONS = {
  digital: '/images/category/category-digital.png',
  kaoyan: '/images/category/category-kaoyan.png',
  book: '/images/category/category-book.png',
  skill: '/images/category/category-skill.png',
  dorm: '/images/category/category-dorm.png',
};

function withCategoryIcons(categories, variant = 'home') {
  const icons = variant === 'category' ? CATEGORY_PAGE_ICONS : CATEGORY_ICONS;
  return categories.map(item => {
    const id = item.categoryId || item.id;
    const iconSrc = Object.prototype.hasOwnProperty.call(icons, id) ? icons[id] : '';
    return { ...item, id, iconSrc };
  });
}

module.exports = { withCategoryIcons };
