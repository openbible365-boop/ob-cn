import AuthenticationServices
import Capacitor
import CryptoKit
import Security
import UIKit

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var currentNonce: String?
    private var authorizationController: ASAuthorizationController?

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pendingCall == nil else {
                call.reject("Apple 登录正在进行中", "APPLE_SIGN_IN_IN_PROGRESS")
                return
            }

            do {
                let nonce = try self.randomNonce()
                self.pendingCall = call
                self.currentNonce = nonce

                let request = ASAuthorizationAppleIDProvider().createRequest()
                request.requestedScopes = [.fullName, .email]
                request.nonce = self.sha256(nonce)

                let controller = ASAuthorizationController(authorizationRequests: [request])
                controller.delegate = self
                controller.presentationContextProvider = self
                self.authorizationController = controller
                controller.performRequests()
            } catch {
                call.reject("无法启动 Apple 登录", "APPLE_SIGN_IN_START_FAILED", error)
            }
        }
    }

    private func finish() {
        pendingCall = nil
        currentNonce = nil
        authorizationController = nil
    }

    private func randomNonce(length: Int = 32) throws -> String {
        precondition(length > 0)
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length

        while remainingLength > 0 {
            var randoms = [UInt8](repeating: 0, count: 16)
            let status = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
            guard status == errSecSuccess else {
                throw NSError(
                    domain: "AppleSignInPlugin",
                    code: Int(status),
                    userInfo: [NSLocalizedDescriptionKey: "Unable to generate a secure nonce"]
                )
            }

            for random in randoms {
                if remainingLength == 0 { break }
                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }
        return result
    }

    private func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard
            let call = pendingCall,
            let nonce = currentNonce,
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let identityTokenData = credential.identityToken,
            let authorizationCodeData = credential.authorizationCode,
            let identityToken = String(data: identityTokenData, encoding: .utf8),
            let authorizationCode = String(data: authorizationCodeData, encoding: .utf8)
        else {
            pendingCall?.reject("Apple 没有返回完整的登录凭证", "APPLE_CREDENTIAL_INCOMPLETE")
            finish()
            return
        }

        var result: [String: Any] = [
            "identityToken": identityToken,
            "authorizationCode": authorizationCode,
            "nonce": nonce,
            "user": credential.user
        ]
        if let email = credential.email { result["email"] = email }
        if let givenName = credential.fullName?.givenName { result["givenName"] = givenName }
        if let familyName = credential.fullName?.familyName { result["familyName"] = familyName }

        call.resolve(result)
        finish()
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        if let authorizationError = error as? ASAuthorizationError,
           authorizationError.code == .canceled {
            pendingCall?.reject("Apple 登录已取消", "APPLE_SIGN_IN_CANCELED", error)
        } else {
            pendingCall?.reject("Apple 登录失败，请稍后重试", "APPLE_SIGN_IN_FAILED", error)
        }
        finish()
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
