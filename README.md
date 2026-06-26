# KoreksiLJK

Aplikasi web statis untuk membuat dan mengoreksi lembar jawaban pilihan ganda A–E seperti OMR.

## Menjalankan

Buka `index.html` melalui Laragon, misalnya:

`http://localhost/app-correct/`

Tidak ada dependency, database, atau proses build. Pemrosesan gambar dilakukan sepenuhnya di browser.

## Alur penggunaan

1. Tentukan jumlah soal (5–50).
2. Tentukan jumlah jawaban yang dinilai dan poin per soal.
3. Isi kunci hanya untuk nomor yang dinilai.
4. Cetak kotak jawaban dalam ukuran A4 landscape dengan skala 100%.
5. Peserta menghitamkan satu lingkaran per soal.
6. Foto seluruh lembar dengan empat kotak penanda sudut terlihat.
7. Unggah foto dan jalankan analisis.

Jika penanda sudut tidak terdeteksi otomatis, klik **Tandai sudut manual** lalu klik kotak dalam urutan kiri atas, kanan atas, kanan bawah, dan kiri bawah.

## Catatan akurasi

- Gunakan pena hitam atau pensil 2B dan hitamkan lingkaran dengan penuh.
- Hindari bayangan, pantulan, lipatan, dan foto buram.
- Jangan mengubah tata letak template setelah diunduh.
- Tinjau jawaban berstatus kosong/ganda sebelum menetapkan nilai akhir.
