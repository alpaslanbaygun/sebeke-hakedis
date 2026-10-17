plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Sürüm GitHub derlemesinde verilir (ör. -PsurumKodu=12 -PsurumAdi=0.2.12); yerelde 1 / 0.1-yerel.
val surumKodu = (project.findProperty("surumKodu") as String?)?.toIntOrNull() ?: 1
val surumAdi = (project.findProperty("surumAdi") as String?) ?: "0.1-yerel"

android {
    namespace = "com.sebekehakedis.mobil"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.sebekehakedis.mobil"
        minSdk = 26
        targetSdk = 34
        versionCode = surumKodu
        versionName = surumAdi
    }

    // Her bilgisayarda ve GitHub'da aynı imza: yeni sürüm telefondakinin üzerine (veriler silinmeden) kurulur.
    signingConfigs {
        create("ortak") {
            storeFile = file("signing/sebeke-hakedis.keystore")
            storePassword = "sebekehakedis"
            keyAlias = "sebekehakedis"
            keyPassword = "sebekehakedis"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("ortak")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("ortak")
        }
    }

    // Malzeme kataloğu ve rapor katsayıları tek kaynaktan (depodaki ortak/katalog) APK'ya girer.
    sourceSets {
        getByName("main") {
            assets.srcDir(layout.buildDirectory.dir("generated/katalog-assets"))
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    androidResources {
        // ui/dev yalnız bilgisayarda önizleme içindir; APK'ya girmez.
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~:<dir>dev:icon-names.txt"
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

val katalogKopyala by tasks.registering(Copy::class) {
    from(rootProject.file("../ortak/katalog"))
    include("*.json")
    into(layout.buildDirectory.dir("generated/katalog-assets/katalog"))
}

tasks.named("preBuild") { dependsOn(katalogKopyala) }

tasks.withType<Test>().configureEach {
    // Türkçe yerelde "Windows" küçük harfe "wındows" diye çevrilir ve Robolectric'in
    // yerel kütüphanesi bulunamaz; testler İngilizce yerelle çalıştırılır.
    systemProperty("user.language", "en")
    systemProperty("user.country", "US")
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("androidx.test:core:1.6.1")
}
