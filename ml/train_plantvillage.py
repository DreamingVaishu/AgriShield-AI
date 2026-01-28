import os
import sys
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

DATA_DIR = os.environ.get("PLANTVILLAGE_DIR", "data/plantvillage")
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = int(os.environ.get("EPOCHS", "10"))
EPOCHS_FINE = int(os.environ.get("EPOCHS_FINE", "5"))
OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "model.h5")

if not os.path.isdir(DATA_DIR):
    print(f"Missing dataset directory: {DATA_DIR}")
    print("Set PLANTVILLAGE_DIR to the root containing class subfolders.")
    sys.exit(1)

train_ds = tf.keras.preprocessing.image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="training",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="int",
)

val_ds = tf.keras.preprocessing.image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="validation",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="int",
)

class_names = train_ds.class_names
num_classes = len(class_names)

AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.cache().shuffle(1000).prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)

data_augmentation = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.1),
    layers.RandomZoom(0.15),
    layers.RandomContrast(0.2),
    layers.RandomBrightness(factor=0.2),
])

base_model = MobileNetV2(weights="imagenet", include_top=False, input_shape=IMG_SIZE + (3,))
base_model.trainable = False

inputs = layers.Input(shape=IMG_SIZE + (3,))
x = data_augmentation(inputs)
x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.2)(x)
outputs = layers.Dense(num_classes, activation="softmax")(x)
model = models.Model(inputs, outputs)

lr_schedule = tf.keras.optimizers.schedules.CosineDecay(initial_learning_rate=1e-3, decay_steps=EPOCHS * 1000)
opt = tf.keras.optimizers.Adam(learning_rate=lr_schedule)
model.compile(
    optimizer=opt,
    loss=tf.keras.losses.SparseCategoricalCrossentropy(label_smoothing=0.1),
    metrics=["accuracy"]
)

callbacks = [
    EarlyStopping(monitor="val_accuracy", patience=3, restore_best_weights=True),
    ModelCheckpoint("best_model.h5", monitor="val_accuracy", save_best_only=True)
]

def count_files(dir_path):
    return sum(1 for _ in tf.io.gfile.listdir(dir_path))

total = 0
counts = []
for name in class_names:
    d = os.path.join(DATA_DIR, name)
    c = len([f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f))])
    counts.append(c)
    total += c

class_weight = {}
for i, c in enumerate(counts):
    class_weight[i] = total / (num_classes * max(c, 1))

history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
    callbacks=callbacks,
    class_weight=class_weight
)

base_model.trainable = True
fine_opt = tf.keras.optimizers.Adam(learning_rate=1e-5)
model.compile(
    optimizer=fine_opt,
    loss=tf.keras.losses.SparseCategoricalCrossentropy(label_smoothing=0.1),
    metrics=["accuracy"]
)

history_fine = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS_FINE,
    callbacks=callbacks,
    class_weight=class_weight
)

model.save(OUTPUT_PATH)

with open("class_names.txt", "w", encoding="utf-8") as f:
    for name in class_names:
        f.write(f"{name}\n")
