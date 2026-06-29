# pyrefly: ignore [missing-import]
from flask import Flask, render_template, request, jsonify, send_file
import sqlite3
from datetime import datetime
import csv
import io

app = Flask(__name__)

def init_db():
    try:
        conn = sqlite3.connect('sales.db')
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            time TEXT,
            description TEXT,
            price REAL,
            payment_type TEXT,
            collected INTEGER DEFAULT 0
        )''')
        conn.commit()
        conn.close()
        print("✅ BD inicializada correctamente")
    except Exception as e:
        print(f"❌ Error en init_db: {e}")

# INICIALIZA AQUÍ (no dentro de if __name__)
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/sales', methods=['POST'])
def add_sale():
    data = request.json
    now = datetime.now()
    date = now.strftime('%Y-%m-%d')
    time = now.strftime('%H:%M:%S')
    
    conn = sqlite3.connect('sales.db')
    c = conn.cursor()
    c.execute('INSERT INTO sales (date, time, description, price, payment_type, collected) VALUES (?, ?, ?, ?, ?, ?)',
              (date, time, data['description'], data['price'], data['payment_type'], 0))
    conn.commit()
    conn.close()
    
    return jsonify({'status': 'success'})

@app.route('/api/sales', methods=['GET'])
def get_sales():
    date_filter = request.args.get('date')
    
    conn = sqlite3.connect('sales.db')
    c = conn.cursor()
    
    if date_filter:
        c.execute('SELECT * FROM sales WHERE date = ? ORDER BY time DESC', (date_filter,))
    else:
        c.execute('SELECT * FROM sales ORDER BY date DESC, time DESC LIMIT 100')
    
    sales = c.fetchall()
    conn.close()
    
    return jsonify([
        {
            'id': s[0],
            'date': s[1],
            'time': s[2],
            'description': s[3],
            'price': s[4],
            'payment_type': s[5],
            'collected': s[6]
        } for s in sales
    ])

@app.route('/api/sales/<int:sale_id>/collect', methods=['PUT'])
def collect_sale(sale_id):
    conn = sqlite3.connect('sales.db')
    c = conn.cursor()
    c.execute('UPDATE sales SET collected = 1 WHERE id = ? AND payment_type = "Efectivo"', (sale_id,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/sales/<int:sale_id>', methods=['DELETE'])
def delete_sale(sale_id):
    conn = sqlite3.connect('sales.db')
    c = conn.cursor()
    c.execute('DELETE FROM sales WHERE id = ?', (sale_id,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/summary', methods=['GET'])
def get_summary():
    month_filter = request.args.get('month')
    if not month_filter:
        month_filter = datetime.now().strftime('%Y-%m')
        
    conn = sqlite3.connect('sales.db')
    c = conn.cursor()
    
    c.execute('SELECT SUM(price) FROM sales WHERE payment_type = "Efectivo" AND date LIKE ?', (f'{month_filter}-%',))
    cash_total = c.fetchone()[0] or 0.0
    
    c.execute('SELECT SUM(price) FROM sales WHERE payment_type = "Tarjeta" AND date LIKE ?', (f'{month_filter}-%',))
    card_total = c.fetchone()[0] or 0.0
    
    conn.close()
    
    return jsonify({
        'month': month_filter,
        'cash': cash_total,
        'card': card_total,
        'total': cash_total + card_total
    })

@app.route('/api/export', methods=['GET'])
def export_csv():
    date_filter = request.args.get('date')
    
    conn = sqlite3.connect('sales.db')
    c = conn.cursor()
    
    if date_filter:
        c.execute('SELECT * FROM sales WHERE date = ? ORDER BY time DESC', (date_filter,))
    else:
        c.execute('SELECT * FROM sales ORDER BY date DESC, time DESC')
    
    sales = c.fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Fecha', 'Hora', 'Descripción', 'Precio', 'Tipo Pago', 'Recogido'])
    
    for sale in sales:
        collected_str = 'No aplica'
        if sale[5] == 'Efectivo':
            collected_str = 'Sí' if sale[6] == 1 else 'No'
        writer.writerow([sale[1], sale[2], sale[3], sale[4], sale[5], collected_str])
    
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'ventas_{datetime.now().strftime("%Y%m%d")}.csv'
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)