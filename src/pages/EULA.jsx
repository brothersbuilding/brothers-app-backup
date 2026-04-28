export default function EULA() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-10">
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">End User License Agreement</h1>
          <p className="text-sm text-gray-500">Brothers Building · Internal Business Application</p>
          <p className="text-sm text-gray-500 mt-1">Last Updated: April 28, 2026</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using this application ("the App"), you agree to be bound by the terms
              and conditions set forth in this End User License Agreement ("EULA"). This EULA is a
              legal agreement between you and Brothers Building. If you do not agree to these terms,
              you must immediately discontinue use of the App.
            </p>
            <p className="mt-2">
              Your continued use of the App constitutes acceptance of this EULA and any updates
              Brothers Building may make to it from time to time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Permitted Use</h2>
            <p>
              This App is provided exclusively for <strong>internal business use</strong> by authorized
              employees and contractors of Brothers Building. You are granted a limited,
              non-exclusive, non-transferable license to use the App solely for the purpose of
              managing and tracking accounts receivable and related business operations on behalf
              of Brothers Building.
            </p>
            <p className="mt-2">You may not:</p>
            <ul className="list-disc list-inside mt-1 space-y-1 text-gray-600">
              <li>Share your login credentials with unauthorized individuals.</li>
              <li>Use the App for any personal, commercial, or third-party purpose.</li>
              <li>Copy, reproduce, or distribute any portion of the App or its data.</li>
              <li>Attempt to reverse-engineer, decompile, or otherwise extract source code.</li>
              <li>Use the App in any manner that violates applicable law or company policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Intellectual Property</h2>
            <p>
              All content, features, functionality, and data contained within the App—including but
              not limited to text, graphics, logos, software, and underlying code—are the exclusive
              property of Brothers Building or its licensors and are protected by applicable
              intellectual property laws.
            </p>
            <p className="mt-2">
              Nothing in this EULA shall be construed as transferring any ownership rights to you.
              All rights not expressly granted herein are reserved by Brothers Building.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Disclaimer of Warranties</h2>
            <p>
              THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
            <p className="mt-2">
              Brothers Building does not warrant that the App will be uninterrupted, error-free,
              or free of harmful components. You assume all responsibility for your use of the App
              and any reliance on information contained therein.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Limitation of Liability</h2>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY LAW, BROTHERS BUILDING SHALL NOT BE LIABLE FOR
              ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF
              OR RELATED TO YOUR USE OF OR INABILITY TO USE THE APP, EVEN IF BROTHERS BUILDING HAS
              BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="mt-2">
              In no event shall Brothers Building's total liability to you for all claims arising
              from or related to this EULA exceed the amount you paid (if any) to access the App in
              the twelve (12) months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Governing Law</h2>
            <p>
              This EULA shall be governed by and construed in accordance with the laws of the State
              of <strong>Oregon</strong>, without regard to its conflict of law provisions. Any
              disputes arising under or in connection with this EULA shall be subject to the
              exclusive jurisdiction of the state and federal courts located in Oregon.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Contact</h2>
            <p>
              If you have any questions about this EULA, please contact Brothers Building through
              your internal company channels.
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Brothers Building. All rights reserved.
        </div>
      </div>
    </div>
  );
}