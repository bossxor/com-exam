plugins {
    id("com.android.application") version "8.13.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
}
val localBuild = file(checkNotNull(System.getenv("LOCALAPPDATA"))).resolve("com1cbt-build")
layout.buildDirectory.set(localBuild.resolve("root"))
