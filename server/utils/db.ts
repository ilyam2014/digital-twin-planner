import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data.db');

let _db: any = null;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    
    // Initialize schema
    _db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        data TEXT NOT NULL
      );
    `);

    // Seed if empty
    const count = _db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    if (count === 0) {
      const insert = _db.prepare('INSERT INTO products (name, category, price, image_url, width, height) VALUES (?, ?, ?, ?, ?, ?)');
      
      const seedProducts = [
        ['Диван Велюр Синий', 'Мебель', 89900, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=600', 200, 120],
        ['Столик Кофейный Дуб', 'Столы', 24900, 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=600', 100, 60],
        ['Торшер Модерн', 'Свет', 12900, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&q=80&w=600', 40, 150],
        ['Кресло Сканди', 'Мебель', 45000, 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&q=80&w=600', 80, 90],
        ['Ковер Джутовый', 'Декор', 18000, 'https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&q=80&w=600', 250, 180],
        ['Картина Абстракция', 'Декор', 7500, 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=600', 60, 80],
        ['Фикус Лирата', 'Растения', 5500, 'https://images.unsplash.com/photo-1597072689227-8882273e8f6a?auto=format&fit=crop&q=80&w=600', 50, 100]
      ];

      for (const p of seedProducts) {
        insert.run(...p);
      }
    }
  }
  return _db;
}

export async function getProducts() {
  const db = getDb();
  return db.prepare('SELECT * FROM products ORDER BY id DESC').all();
}

export async function addProduct(product: any) {
  const db = getDb();
  const insert = db.prepare('INSERT INTO products (name, category, price, image_url, width, height) VALUES (?, ?, ?, ?, ?, ?)');
  const result = insert.run(
    product.name,
    product.category,
    product.price,
    product.image_url,
    product.width,
    product.height
  );
  return { ...product, id: result.lastInsertRowid };
}

export async function getProjects() {
  const db = getDb();
  return db.prepare('SELECT * FROM projects').all();
}

